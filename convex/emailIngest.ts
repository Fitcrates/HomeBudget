"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

type ResendReceivedEmail = {
  id: string;
  to: string[];
  from: string;
  created_at: string;
  subject: string | null;
  html: string | null;
  text: string | null;
  attachments?: Array<{
    id: string;
    filename: string | null;
    content_type: string | null;
  }>;
};

type ResendAttachment = {
  id: string;
  filename: string | null;
  content_type: string | null;
  download_url: string;
};

type ExistingPendingLookup = {
  status: "pending" | "approved" | "rejected";
} | null;

type IngestEmailResult =
  | {
      ok: true;
      skipped?: boolean;
      reason?: "already_ingested";
      status?: "pending" | "approved" | "rejected";
      detectedBy?: "ocr" | "text" | "fallback";
      itemCount?: number;
      attachmentCount?: number;
    }
  | {
      ok: false;
      reason: "no_matching_inbox" | "empty_email";
    };

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Brak zmiennej środowiskowej ${name}.`);
  }
  return value;
}

function stripHtml(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeEmailAddress(value: string) {
  const match = value.match(/<([^>]+)>/);
  return (match?.[1] ?? value).trim().toLowerCase();
}

function isSupportedAttachment(contentType: string, filename: string) {
  const normalizedType = contentType.toLowerCase();
  const normalizedName = filename.toLowerCase();

  return (
    normalizedType.startsWith("image/") ||
    normalizedType === "application/pdf" ||
    normalizedName.endsWith(".pdf") ||
    normalizedName.endsWith(".jpg") ||
    normalizedName.endsWith(".jpeg") ||
    normalizedName.endsWith(".png") ||
    normalizedName.endsWith(".webp")
  );
}

async function fetchResendJson<T>(path: string): Promise<T> {
  const response = await fetch(`https://api.resend.com${path}`, {
    headers: {
      Authorization: `Bearer ${getRequiredEnv("RESEND_API_KEY")}`,
      "User-Agent": "homebudget-inbound/1.0",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Resend API ${response.status}: ${errorText}`);
  }

  return (await response.json()) as T;
}

async function getReceivedEmail(emailId: string) {
  const response = await fetchResendJson<ResendReceivedEmail | { data: ResendReceivedEmail }>(
    `/emails/receiving/${emailId}`
  );

  const email = "data" in response ? response.data : response;
  if (!email || !Array.isArray(email.to)) {
    throw new Error("Resend returned an unexpected received email payload.");
  }

  return email;
}

async function listAttachments(emailId: string) {
  const response = await fetchResendJson<ResendAttachment[] | { data: ResendAttachment[] }>(
    `/emails/receiving/${emailId}/attachments`
  );

  if (Array.isArray(response)) {
    return response;
  }

  return Array.isArray(response.data) ? response.data : [];
}

async function storeDownloadedAttachment(
  ctx: any,
  attachment: ResendAttachment
): Promise<{ storageId: Id<"_storage">; filename: string; mimeType: string }> {
  const response = await fetch(attachment.download_url);
  if (!response.ok) {
    throw new Error(`Nie udało się pobrać załącznika ${attachment.filename ?? attachment.id}.`);
  }

  const mimeType = attachment.content_type || response.headers.get("content-type") || "application/octet-stream";
  const buffer = await response.arrayBuffer();
  const blob = new Blob([buffer], { type: mimeType });
  const storageId = await ctx.storage.store(blob);

  return {
    storageId,
    filename: attachment.filename || "zalacznik",
    mimeType,
  };
}

export const ingestResendEmail = internalAction({
  args: {
    emailId: v.string(),
    emailFrom: v.string(),
    emailTo: v.array(v.string()),
    emailSubject: v.string(),
    receivedAt: v.number(),
  },
  handler: async (ctx, args): Promise<IngestEmailResult> => {
    const existingPending = (await ctx.runQuery(
      internal.emailTokens.getPendingExpenseByProviderMessageId as any,
      {
        providerMessageId: args.emailId,
      }
    )) as ExistingPendingLookup;

    if (existingPending) {
      return {
        ok: true,
        skipped: true,
        reason: "already_ingested",
        status: existingPending.status,
      };
    }

    const email = await getReceivedEmail(args.emailId);
    const recipients = Array.isArray(email.to) ? email.to.map((value) => normalizeEmailAddress(value)) : [];

    let matchedInbox: {
      _id: Id<"email_inboxes">;
      householdId: Id<"households">;
      address: string;
    } | null = null;

    let matchedRecipient: string | null = null;
    for (const recipient of recipients) {
      const inbox = await ctx.runQuery(internal.emailTokens.findInboxByAddress, {
        address: recipient,
      });
      if (inbox) {
        matchedInbox = inbox;
        matchedRecipient = recipient;
        break;
      }
    }

    if (!matchedInbox || !matchedRecipient) {
      console.warn("Inbound email ignored: no matching inbox", {
        emailId: args.emailId,
        recipients,
      });
      return { ok: false, reason: "no_matching_inbox" };
    }

    const rawEmailText = (email.text || "").trim();
    const rawEmailHtml = email.html || undefined;
    const fallbackText = rawEmailText || stripHtml(email.html || "");

    const attachmentMetadata = await listAttachments(args.emailId);
    const supportedAttachments = attachmentMetadata
      .filter((attachment) =>
        isSupportedAttachment(attachment.content_type || "", attachment.filename || "")
      )
      .slice(0, 5);

    const storedAttachments: Array<{
      storageId: Id<"_storage">;
      filename: string;
      mimeType: string;
    }> = [];

    for (const attachment of supportedAttachments) {
      storedAttachments.push(await storeDownloadedAttachment(ctx, attachment));
    }

    let parsedItems: Array<{
      description: string;
      amount: number;
      categoryId?: Id<"categories">;
      subcategoryId?: Id<"subcategories">;
      confidence?: string;
      sourceStorageId?: Id<"_storage">;
    }> = [];
    let ocrRawText: string | undefined;
    let detectedBy: "ocr" | "text" | "fallback" = "fallback";
    let sourceSummary = "";

    if (storedAttachments.length > 0) {
      const result = await ctx.runAction(internal.ocr.processEmailAttachments, {
        householdId: matchedInbox.householdId,
        storageIds: storedAttachments.map((attachment) => attachment.storageId),
        mimeTypes: storedAttachments.map((attachment) => attachment.mimeType),
        fallbackText,
      });

      parsedItems = (result.items ?? []).map((item: any) => {
        const sourceStorageId =
          typeof item.sourceImageIndex === "number" && item.sourceImageIndex > 0
            ? storedAttachments[item.sourceImageIndex - 1]?.storageId
            : storedAttachments[0]?.storageId;

        return {
          description: item.description || "Pozycja z rachunku",
          amount: Math.round((parseFloat(String(item.amount || "0").replace(",", ".")) || 0) * 100),
          categoryId: item.categoryId || undefined,
          subcategoryId: item.subcategoryId || undefined,
          confidence: "high",
          sourceStorageId,
        };
      }).filter((item: { amount: number }) => item.amount > 0);

      ocrRawText = result.rawText || undefined;
      detectedBy = parsedItems.length > 0 ? "ocr" : "fallback";
      sourceSummary = `Przetworzono ${storedAttachments.length} załącznik(i): ${storedAttachments.map((item) => item.filename).join(", ")}.`;
    }

    if (parsedItems.length === 0 && fallbackText) {
      const result = await ctx.runAction(internal.ocr.processEmailBodyText, {
        householdId: matchedInbox.householdId,
        text: fallbackText,
      });

      parsedItems = (result.items ?? []).map((item: any) => ({
        description: item.description || "Pozycja z maila",
        amount: Math.round((parseFloat(String(item.amount || "0").replace(",", ".")) || 0) * 100),
        categoryId: item.categoryId || undefined,
        subcategoryId: item.subcategoryId || undefined,
        confidence: "medium",
      })).filter((item: { amount: number }) => item.amount > 0);

      ocrRawText = ocrRawText || result.rawText || undefined;
      detectedBy = parsedItems.length > 0 ? "text" : "fallback";
      sourceSummary = sourceSummary || "Nie znaleziono użytecznych załączników, więc użyto treści maila.";
    }

    if (parsedItems.length === 0 && !fallbackText && storedAttachments.length === 0) {
      return { ok: false, reason: "empty_email" };
    }

    await ctx.runMutation(internal.emailTokens.savePendingExpense, {
      householdId: matchedInbox.householdId,
      providerMessageId: args.emailId,
      emailFrom: normalizeEmailAddress(email.from || args.emailFrom),
      emailTo: matchedRecipient,
      emailSubject: email.subject || args.emailSubject || "(bez tematu)",
      emailReceivedAt: Number.isFinite(args.receivedAt) ? args.receivedAt : Date.now(),
      rawEmailText: fallbackText.slice(0, 20000),
      rawEmailHtml,
      ocrRawText,
      matchedInboxAddress: matchedInbox.address,
      detectedBy,
      sourceSummary,
      attachmentNames: storedAttachments.map((attachment) => attachment.filename),
      storageIds: storedAttachments.map((attachment) => attachment.storageId),
      items: parsedItems,
    });

    await ctx.runMutation(internal.emailTokens.markInboxReceived, {
      inboxId: matchedInbox._id,
      receivedAt: Number.isFinite(args.receivedAt) ? args.receivedAt : Date.now(),
    });

    return {
      ok: true,
      detectedBy,
      itemCount: parsedItems.length,
      attachmentCount: storedAttachments.length,
    };
  },
});
