"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import OpenAI from "openai";

function getOpenAI() {
  return new OpenAI({
    baseURL: process.env.CONVEX_OPENAI_BASE_URL,
    apiKey: process.env.CONVEX_OPENAI_API_KEY,
  });
}

export const callOpenAI = internalAction({
  args: {
    expenses: v.array(
      v.object({ categoryName: v.string(), month: v.string(), total: v.number() })
    ),
    budgets: v.array(
      v.object({ categoryName: v.string(), limitAmount: v.number(), period: v.string() })
    ),
  },
  handler: async (_ctx, args) => {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
    const dayOfMonth = now.getDate();

    const prompt = [
      "Jestes asystentem finansowym dla polskiej rodziny.",
      "Przeanalizuj dane wydatkow i wygeneruj 4-6 inteligentnych wskazowek po polsku.",
      "",
      "Dane wydatkow (ostatnie 3 miesiace, kwoty w groszach):",
      JSON.stringify(args.expenses),
      "",
      "Budzety kategorii (limity w groszach):",
      JSON.stringify(args.budgets),
      "",
      `Dzisiaj: ${now.toLocaleDateString("pl-PL")} (dzien ${dayOfMonth} z ${daysInMonth} w miesiacu)`,
      "",
      "Typy wskazowek: prediction (prognoza), anomaly (anomalia), saving (oszczednosci), budget_alert (alert budzetu).",
      "severity: info=neutralna, warning=uwaga, danger=pilne (tylko gdy budzet przekroczony).",
      "Badz konkretny, uzywaj liczb. Odpowiedz TYLKO poprawnym JSON:",
      '{"insights":[{"type":"prediction","title":"Krotki tytul max 6 slow","body":"1-2 zdania z liczbami","emoji":"emoji","severity":"info"}]}',
    ].join("\n");

    const resp = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });

    const content = resp.choices[0].message.content ?? "{}";
    let parsed: { insights?: unknown[] } = {};
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = { insights: [] };
    }

    const rawInsights = Array.isArray(parsed.insights) ? parsed.insights : [];
    return rawInsights
      .filter((i): i is Record<string, unknown> => typeof i === "object" && i !== null)
      .map((i) => ({
        type: typeof i.type === "string" ? i.type : "info",
        title: typeof i.title === "string" ? i.title : "",
        body: typeof i.body === "string" ? i.body : "",
        emoji: typeof i.emoji === "string" ? i.emoji : "💡",
        severity: (["info", "warning", "danger"].includes(i.severity as string)
          ? i.severity
          : "info") as "info" | "warning" | "danger",
      }));
  },
});
