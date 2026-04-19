import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { assertMember } from "./households";
import type { Id } from "./_generated/dataModel";
import { listEffectivelyPendingEmailExpenses } from "./lib/pendingEmailExpenses";

const ALIAS_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const ALIAS_SUFFIX_LENGTH = 6;

function getReceivingDomain() {
  return (
    process.env.RESEND_INBOUND_DOMAIN?.trim().toLowerCase() ||
    process.env.RESEND_RECEIVING_DOMAIN?.trim().toLowerCase() ||
    ""
  );
}

function normalizeSlugPart(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 18);
}

function randomSuffix(length = ALIAS_SUFFIX_LENGTH) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);

  let value = "";
  for (const byte of bytes) {
    value += ALIAS_ALPHABET[byte % ALIAS_ALPHABET.length];
  }
  return value;
}

async function generateUniqueAlias(ctx: any, householdName: string) {
  const base = normalizeSlugPart(householdName) || "dom";

  for (let attempt = 0; attempt < 20; attempt++) {
    const alias = `rachunki-${base}-${randomSuffix()}`;
    const existing = await ctx.db
      .query("email_inboxes")
      .withIndex("by_alias", (q: any) => q.eq("alias", alias))
      .unique();

    if (!existing) {
      return alias;
    }
  }

  throw new Error("Nie udało się wygenerować unikalnego adresu email.");
}

function buildAddress(alias: string, domain: string) {
  return `${alias}@${domain}`;
}

async function getInboxWithAuth(ctx: any, householdId: Id<"households">, userId: Id<"users">) {
  await assertMember(ctx, householdId, userId);

  return await ctx.db
    .query("email_inboxes")
    .withIndex("by_household", (q: any) => q.eq("householdId", householdId))
    .unique();
}

export const get = query({
  args: { householdId: v.id("households") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const inbox = await getInboxWithAuth(ctx, args.householdId, userId);
    if (!inbox) return null;

    const pending = await listEffectivelyPendingEmailExpenses(ctx, args.householdId);

    return {
      ...inbox,
      isResendConfigured: Boolean(getReceivingDomain()),
      pendingCount: pending.length,
    };
  },
});

export const getSetup = query({
  args: { householdId: v.id("households") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const inbox = await getInboxWithAuth(ctx, args.householdId, userId);
    const pending = await listEffectivelyPendingEmailExpenses(ctx, args.householdId);

    return {
      inbox,
      isResendConfigured: Boolean(getReceivingDomain()),
      receivingDomain: getReceivingDomain() || null,
      pendingCount: pending.length,
      lastPendingAt: pending[0]?.emailReceivedAt ?? null,
    };
  },
});

export const getOrCreate = mutation({
  args: { householdId: v.id("households") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const receivingDomain = getReceivingDomain();
    if (!receivingDomain) {
      throw new Error("Brak konfiguracji RESEND_INBOUND_DOMAIN w backendzie.");
    }

    const household = await ctx.db.get(args.householdId);
    if (!household) throw new Error("Household not found");

    const existing = await getInboxWithAuth(ctx, args.householdId, userId);
    if (existing) {
      const nextAddress = buildAddress(existing.alias, receivingDomain);
      if (existing.address !== nextAddress) {
        await ctx.db.patch(existing._id, {
          address: nextAddress,
          updatedAt: Date.now(),
        });
      }
      return nextAddress;
    }

    const alias = await generateUniqueAlias(ctx, household.name);
    const address = buildAddress(alias, receivingDomain);
    const now = Date.now();

    await ctx.db.insert("email_inboxes", {
      householdId: args.householdId,
      provider: "resend",
      alias,
      address,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

    return address;
  },
});

export const regenerate = mutation({
  args: { householdId: v.id("households") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const receivingDomain = getReceivingDomain();
    if (!receivingDomain) {
      throw new Error("Brak konfiguracji RESEND_INBOUND_DOMAIN w backendzie.");
    }

    const household = await ctx.db.get(args.householdId);
    if (!household) throw new Error("Household not found");

    const existing = await getInboxWithAuth(ctx, args.householdId, userId);
    const alias = await generateUniqueAlias(ctx, household.name);
    const address = buildAddress(alias, receivingDomain);
    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        alias,
        address,
        status: "active",
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("email_inboxes", {
        householdId: args.householdId,
        provider: "resend",
        alias,
        address,
        status: "active",
        createdAt: now,
        updatedAt: now,
      });
    }

    return address;
  },
});

export const findInboxByAddress = internalQuery({
  args: { address: v.string() },
  handler: async (ctx, args) => {
    const normalized = args.address.trim().toLowerCase();
    const inbox = await ctx.db
      .query("email_inboxes")
      .withIndex("by_address", (q) => q.eq("address", normalized))
      .unique();

    if (!inbox || inbox.status !== "active") return null;
    return inbox;
  },
});

export const getPendingExpenseByProviderMessageId = internalQuery({
  args: { providerMessageId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("pending_email_expenses")
      .withIndex("by_provider_message_id", (q) =>
        q.eq("providerMessageId", args.providerMessageId)
      )
      .unique();
  },
});

export const markInboxReceived = internalMutation({
  args: {
    inboxId: v.id("email_inboxes"),
    receivedAt: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.inboxId, {
      lastReceivedAt: args.receivedAt,
      updatedAt: Date.now(),
    });
  },
});

export const savePendingExpense = internalMutation({
  args: {
    householdId: v.id("households"),
    providerMessageId: v.string(),
    emailFrom: v.string(),
    emailTo: v.string(),
    emailSubject: v.string(),
    emailReceivedAt: v.number(),
    rawEmailText: v.string(),
    rawEmailHtml: v.optional(v.string()),
    ocrRawText: v.optional(v.string()),
    matchedInboxAddress: v.string(),
    detectedBy: v.union(v.literal("ocr"), v.literal("text"), v.literal("fallback")),
    sourceSummary: v.optional(v.string()),
    attachmentNames: v.array(v.string()),
    storageIds: v.array(v.id("_storage")),
    items: v.array(
      v.object({
        description: v.string(),
        amount: v.number(),
        categoryId: v.optional(v.id("categories")),
        subcategoryId: v.optional(v.id("subcategories")),
        confidence: v.optional(v.string()),
        sourceStorageId: v.optional(v.id("_storage")),
      })
    ),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("pending_email_expenses")
      .withIndex("by_provider_message_id", (q) => q.eq("providerMessageId", args.providerMessageId))
      .unique();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("pending_email_expenses", {
      ...args,
      status: "pending",
      isProcessed: false,
      processedExpenseIds: [],
    });
  },
});
