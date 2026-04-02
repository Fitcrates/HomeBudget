"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import OpenAI from "openai";

function getGroq() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("Brak klucza API Groq (GROQ_API_KEY)");
  }
  return new OpenAI({
    baseURL: "https://api.groq.com/openai/v1",
    apiKey,
  });
}

export const callAI = internalAction({
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
      "Jesteś precyzyjnym asystentem finansowym dla polskiej rodziny.",
      "Przeanalizuj z dużą dokładnością dane wydatków.",
      "",
      "Dane wydatkow (ostatnie miesiące, kwoty w PLN to DOKŁADNE SUMY, których nie możesz zmyślać):",
      JSON.stringify(args.expenses),
      "",
      "Budzety kategorii (limity w PLN):",
      JSON.stringify(args.budgets),
      "",
      `Dzisiaj: ${now.toLocaleDateString("pl-PL")} (dzien ${dayOfMonth} z ${daysInMonth} w miesiacu)`,
      "",
      "ZASADY:",
      "- BAZUJ TYLKO NA podanych kwotach z 'Dane wydatkow'. Twoje wyliczenia MUSZĄ się zgadzać z danymi JSON. Absolutnie nie wymyślaj dużych kwot poza tym progiem.",
      "- Kwoty podawaj w pełnych złotych (PLN), z dopiskiem 'zł'.",
      "- Jesteśmy w trackie miesiąca. Nie twórz kosmicznych prognoz na cały rok (jak 35 000 zł) z kilku dni.",
      "- Zamiast wymyślać 3000 zł, pisz ZGODNIE Z PRAWDĄ (np: 'Wydałeś 203 zł, to jest X% Twojego budżetu...').",
      "- Bądź lakoniczny ale wysoce analityczny, używaj liczb, ale TYLKO prawidłowych, wynikających z dostarczonego JSON.",
      "",
      "Typy wskazowek: prediction (prosta i wnikliwa prognoza), anomaly (gdy kwota znacząco odbiega od prostej średniej), saving (co uciąć), budget_alert (alert dla kategorii, w której przekroczono budżet).",
      "severity: info, warning, danger.",
      "Odpowiedz TYLKO i WYŁĄCZNIE poprawnym JSON:",
      '{"insights":[{"type":"prediction","title":"Krotki tytul max 6 slow","body":"2-3 bardzo analityczne i BEZBŁĘDNE matematycznie zdania.","emoji":"emoji","severity":"info"}]}',
    ].join("\\n");

    const resp = await getGroq().chat.completions.create({
      model: "llama-3.3-70b-versatile",
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
