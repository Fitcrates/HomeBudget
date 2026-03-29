import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

// Inbound email webhook — supports Mailgun, SendGrid, and generic POST
// Token is passed as a query param: /api/email-ingest?token=abc123xyz
http.route({
  path: "/api/email-ingest",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    try {
      const url = new URL(req.url);
      const token = url.searchParams.get("token") ?? "";

      if (!token) {
        return new Response(JSON.stringify({ error: "Missing token" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const contentType = req.headers.get("content-type") ?? "";
      let emailFrom = "";
      let emailSubject = "";
      let emailText = "";
      let emailHtml = "";

      if (contentType.includes("application/json")) {
        const body = await req.json();
        emailFrom = body.from ?? body.sender ?? "";
        emailSubject = body.subject ?? "";
        emailText = body.text ?? body.plain ?? body.body ?? "";
        emailHtml = body.html ?? "";
      } else if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
        // Mailgun / SendGrid form-encoded
        const formData = await req.formData();
        emailFrom = (formData.get("from") ?? formData.get("sender") ?? "") as string;
        emailSubject = (formData.get("subject") ?? "") as string;
        emailText = (formData.get("body-plain") ?? formData.get("text") ?? formData.get("plain") ?? "") as string;
        emailHtml = (formData.get("body-html") ?? formData.get("html") ?? "") as string;
      } else {
        const raw = await req.text();
        emailText = raw;
      }

      await ctx.runAction(internal.emailIngest.parseAndSaveEmail, {
        token,
        emailFrom,
        emailSubject,
        emailText,
        emailHtml,
        receivedAt: Date.now(),
      });

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (err: any) {
      console.error("Email ingest error:", err);
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }),
});

export default http;
