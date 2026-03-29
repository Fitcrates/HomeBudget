"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import OpenAI from "openai";

export const parseAndSaveEmail = internalAction({
  args: {
    token: v.string(),
    emailFrom: v.string(),
    emailSubject: v.string(),
    emailText: v.string(),
    emailHtml: v.optional(v.string()),
    receivedAt: v.number(),
  },
  handler: async (ctx, args) => {
    // Find household by token
    const householdId = await ctx.runQuery(internal.emailTokens.findHouseholdByToken, {
      token: args.token,
    });

    if (!householdId) {
      console.warn("No household found for token:", args.token);
      return { ok: false, reason: "invalid_token" };
    }

    // Use plain text, fallback to stripping HTML tags
    const bodyText = args.emailText || (args.emailHtml ?? "").replace(/<[^>]+>/g, " ").trim();
    const truncated = bodyText.slice(0, 3000);

    const prompt = `Jesteś asystentem finansowym. Przeanalizuj poniższy email i wyciągnij z niego wydatki/zakupy.

Temat: ${args.emailSubject}
Od: ${args.emailFrom}
Treść:
${truncated}

Zwróć TYLKO poprawny JSON (bez Markdown):
{
  "items": [
    {
      "description": "Nazwa produktu/usługi",
      "amount": 1234,
      "confidence": "high"
    }
  ]
}

Zasady:
- amount to liczba całkowita w GROSZACH (np. 29.99 zł = 2999)
- Jeśli nie możesz określić kwoty, wpisz 0
- confidence: "high" jeśli kwota jest pewna, "low" jeśli niepewna
- Uwzględnij tylko rzeczywiste zakupy/wydatki, pomiń reklamy i newslettery
- Jeśli email nie zawiera żadnych wydatków, zwróć pustą tablicę items: []`;

    let items: Array<{
      description: string;
      amount: number;
      confidence: string;
    }> = [];

    const openai = new OpenAI({
      baseURL: process.env.CONVEX_OPENAI_BASE_URL,
      apiKey: process.env.CONVEX_OPENAI_API_KEY,
    });

    try {
      const resp = await openai.chat.completions.create({
        model: "gpt-4.1-nano",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      });

      const content = resp.choices[0].message.content ?? "{}";
      const parsed = JSON.parse(content);
      const rawItems = Array.isArray(parsed.items) ? parsed.items : [];

      items = rawItems
        .filter((i: any) => typeof i === "object" && i !== null)
        .map((i: any) => ({
          description: typeof i.description === "string" ? i.description : "Nieznany wydatek",
          amount: typeof i.amount === "number" && i.amount >= 0 ? Math.round(i.amount) : 0,
          confidence: i.confidence === "low" ? "low" : "high",
        }));
    } catch (err) {
      console.error("OpenAI parse error:", err);
      // Save with empty items so user can see the email arrived
      items = [];
    }

    if (items.length === 0 && truncated.length < 50) {
      // Likely spam/empty, skip
      return { ok: false, reason: "no_items" };
    }

    await ctx.runMutation(internal.emailTokens.savePendingExpense, {
      householdId,
      emailFrom: args.emailFrom,
      emailSubject: args.emailSubject,
      emailReceivedAt: args.receivedAt,
      rawEmailText: truncated,
      items,
    });

    return { ok: true, itemCount: items.length };
  },
});
