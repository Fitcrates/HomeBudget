import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

function getHeader(headers: Headers, names: string[]) {
  for (const name of names) {
    const value = headers.get(name);
    if (value) return value;
  }
  return "";
}

function normalizeBase64(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad = normalized.length % 4;
  return pad === 0 ? normalized : normalized + "=".repeat(4 - pad);
}

function base64ToBytes(value: string) {
  const binary = atob(normalizeBase64(value));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function encodeBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function timingSafeEqualStrings(a: string, b: string) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

async function verifyResendWebhook(payload: string, headers: Headers) {
  const secret = process.env.RESEND_WEBHOOK_SECRET?.trim();
  if (!secret) return true;

  const msgId = getHeader(headers, ["svix-id", "webhook-id"]);
  const timestamp = getHeader(headers, ["svix-timestamp", "webhook-timestamp"]);
  const signatureHeader = getHeader(headers, ["svix-signature", "webhook-signature"]);

  if (!msgId || !timestamp || !signatureHeader) {
    return false;
  }

  const timestampSeconds = Number(timestamp);
  if (!Number.isFinite(timestampSeconds)) {
    return false;
  }

  const ageSeconds = Math.abs(Date.now() / 1000 - timestampSeconds);
  if (ageSeconds > 5 * 60) {
    return false;
  }

  const secretValue = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  const key = await crypto.subtle.importKey(
    "raw",
    base64ToBytes(secretValue),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signedContent = `${msgId}.${timestamp}.${payload}`;
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedContent));
  const expected = encodeBase64(new Uint8Array(digest));

  const signatures = signatureHeader
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => (part.includes(",") ? part.split(",")[1] : part))
    .filter(Boolean);

  return signatures.some((candidate) => timingSafeEqualStrings(candidate, expected));
}

async function handleInboundWebhook(ctx: any, req: Request) {
  const payload = await req.text();

  if (!(await verifyResendWebhook(payload, req.headers))) {
    return new Response(JSON.stringify({ error: "Invalid webhook signature" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const event = JSON.parse(payload);
    if (event?.type !== "email.received" || !event?.data?.email_id) {
      return new Response(JSON.stringify({ ok: true, ignored: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    await ctx.runAction(internal.emailIngest.ingestResendEmail, {
      emailId: String(event.data.email_id),
      emailFrom: String(event.data.from ?? ""),
      emailTo: Array.isArray(event.data.to)
        ? event.data.to.map((value: unknown) => String(value))
        : [],
      emailSubject: String(event.data.subject ?? ""),
      receivedAt: event.data.created_at ? Date.parse(String(event.data.created_at)) : Date.now(),
    });

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Inbound email webhook error:", error);
    return new Response(JSON.stringify({ error: error.message || "Webhook error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

http.route({
  path: "/api/resend/inbound",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    return await handleInboundWebhook(ctx, req);
  }),
});

// Legacy path kept so the old UI links do not silently break.
http.route({
  path: "/api/email-ingest",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    return await handleInboundWebhook(ctx, req);
  }),
});

export default http;
