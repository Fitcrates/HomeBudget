"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";

type ExpenseRow = {
  categoryName: string;
  month: string;
  total: number;
};

type BudgetRow = {
  categoryName: string;
  limitAmount: number;
  period: string;
};

type Insight = {
  type: string;
  title: string;
  body: string;
  emoji: string;
  severity: "info" | "warning" | "danger";
};

function formatPln(value: number): string {
  return `${Math.round(value)} zł`;
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
}

function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function buildMonthlyCategoryMap(expenses: ExpenseRow[]) {
  const byMonth = new Map<string, Map<string, number>>();

  for (const expense of expenses) {
    if (!byMonth.has(expense.month)) {
      byMonth.set(expense.month, new Map());
    }
    const monthMap = byMonth.get(expense.month)!;
    monthMap.set(expense.categoryName, (monthMap.get(expense.categoryName) ?? 0) + expense.total);
  }

  return byMonth;
}

function buildBudgetMap(budgets: BudgetRow[]) {
  const map = new Map<string, BudgetRow>();
  for (const budget of budgets) {
    map.set(budget.categoryName, budget);
  }
  return map;
}

function makePredictionInsight(
  currentTotal: number,
  previousTotal: number,
  dayOfMonth: number,
  daysInMonth: number
): Insight {
  if (!(currentTotal > 0)) {
    return {
      type: "prediction",
      title: "Brak biezacych wydatkow",
      body: "W tym miesiacu nie ma jeszcze wydatkow do analizy. Gdy pojawia sie pierwsze paragony, prognoza miesieczna bedzie liczona na realnych danych zamiast zgadywania.",
      emoji: "🧭",
      severity: "info",
    };
  }

  const projected = (currentTotal / Math.max(dayOfMonth, 1)) * daysInMonth;
  const deltaVsPrevious = previousTotal > 0
    ? ((projected - previousTotal) / previousTotal) * 100
    : null;

  const body = previousTotal > 0
    ? `Do dzis wydaliscie ${formatPln(currentTotal)}. Przy obecnym tempie miesiac domknie sie w okolicach ${formatPln(projected)}, czyli o ${clampPercent(Math.abs(deltaVsPrevious || 0))}% ${projected >= previousTotal ? "wiecej" : "mniej"} niz poprzedni miesiac (${formatPln(previousTotal)}).`
    : `Do dzis wydaliscie ${formatPln(currentTotal)}. Przy obecnym tempie miesiac domknie sie w okolicach ${formatPln(projected)} - to prognoza oparta tylko na dotychczasowym tempie wydatkow z tego miesiaca.`;

  return {
    type: "prediction",
    title: "Tempo miesiaca",
    body,
    emoji: projected > previousTotal * 1.15 && previousTotal > 0 ? "📈" : "📊",
    severity: projected > previousTotal * 1.15 && previousTotal > 0 ? "warning" : "info",
  };
}

function makeBudgetInsight(
  currentMonthMap: Map<string, number>,
  budgetMap: Map<string, BudgetRow>,
  dayOfMonth: number,
  daysInMonth: number
): Insight {
  const candidates = [...currentMonthMap.entries()]
    .map(([categoryName, spent]) => {
      const budget = budgetMap.get(categoryName);
      if (!budget || !(budget.limitAmount > 0) || budget.period !== "month") return null;
      const ratio = spent / budget.limitAmount;
      const paceRatio = (spent / Math.max(dayOfMonth, 1)) * daysInMonth / budget.limitAmount;
      return { categoryName, spent, budget: budget.limitAmount, ratio, paceRatio };
    })
    .filter(Boolean) as Array<{ categoryName: string; spent: number; budget: number; ratio: number; paceRatio: number }>;

  const overBudget = candidates
    .filter((c) => c.ratio >= 1)
    .sort((a, b) => b.ratio - a.ratio)[0];

  if (overBudget) {
    return {
      type: "budget_alert",
      title: "Budzet przekroczony",
      body: `${overBudget.categoryName} ma juz ${formatPln(overBudget.spent)} przy limicie ${formatPln(overBudget.budget)}. To ${clampPercent((overBudget.ratio - 1) * 100)}% ponad budzet, wiec ta kategoria najbardziej podbija miesieczny wynik.`,
      emoji: "🚨",
      severity: "danger",
    };
  }

  const nearBudget = candidates
    .filter((c) => c.ratio >= 0.8 || c.paceRatio >= 1)
    .sort((a, b) => Math.max(b.ratio, b.paceRatio) - Math.max(a.ratio, a.paceRatio))[0];

  if (nearBudget) {
    return {
      type: "budget_alert",
      title: "Budzet pod presja",
      body: `${nearBudget.categoryName} wykorzystalo juz ${clampPercent(nearBudget.ratio * 100)}% miesiecznego limitu (${formatPln(nearBudget.spent)} z ${formatPln(nearBudget.budget)}). Przy obecnym tempie ta kategoria moze dojsc do okolo ${clampPercent(nearBudget.paceRatio * 100)}% budzetu do konca miesiaca.`,
      emoji: "⚠️",
      severity: nearBudget.ratio >= 0.9 ? "warning" : "info",
    };
  }

  const topWithoutBudget = [...currentMonthMap.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topWithoutBudget) {
    return {
      type: "budget_alert",
      title: "Ustaw kolejny limit",
      body: `Najwieksza kategoria bez wyraznego alertu budzetowego to ${topWithoutBudget[0]} z wynikiem ${formatPln(topWithoutBudget[1])}. Jesli chcecie szybciej lapac odchylenia, to najlepszy kandydat do stalego limitu na kolejny miesiac.`,
      emoji: "🎯",
      severity: "info",
    };
  }

  return {
    type: "budget_alert",
    title: "Budzety sa spokojne",
    body: "Nie widac teraz kategorii, ktora mocno wychodzila poza zalozone limity. To dobry moment, zeby pilnowac regularnosci zamiast gasic przekroczenia na koniec miesiaca.",
    emoji: "🛡️",
    severity: "info",
  };
}

function makeTrendInsight(
  currentMonthMap: Map<string, number>,
  previousMonths: string[],
  byMonth: Map<string, Map<string, number>>,
  currentTotal: number
): Insight {
  const anomalyCandidates = [...currentMonthMap.entries()]
    .map(([categoryName, currentSpent]) => {
      const historical = previousMonths
        .map((month) => byMonth.get(month)?.get(categoryName) ?? 0)
        .filter((value) => value > 0);
      if (historical.length === 0) return null;
      const avg = historical.reduce((sum, value) => sum + value, 0) / historical.length;
      if (!(avg > 0) || currentSpent < 30) return null;
      const deltaPct = ((currentSpent - avg) / avg) * 100;
      return { categoryName, currentSpent, avg, deltaPct };
    })
    .filter(Boolean) as Array<{ categoryName: string; currentSpent: number; avg: number; deltaPct: number }>;

  const strongestIncrease = anomalyCandidates
    .filter((candidate) => candidate.deltaPct >= 25)
    .sort((a, b) => b.deltaPct - a.deltaPct)[0];

  if (strongestIncrease) {
    return {
      type: "anomaly",
      title: "Najwieksze odchylenie",
      body: `${strongestIncrease.categoryName} ma teraz ${formatPln(strongestIncrease.currentSpent)}, a srednia z poprzednich miesiecy to ${formatPln(strongestIncrease.avg)}. To wzrost o ${clampPercent(strongestIncrease.deltaPct)}%, wiec tutaj najbardziej widac zmiane nawyku lub jednorazowy skok.`,
      emoji: "🔎",
      severity: strongestIncrease.deltaPct >= 60 ? "warning" : "info",
    };
  }

  const topCategory = [...currentMonthMap.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topCategory && currentTotal > 0) {
    const share = (topCategory[1] / currentTotal) * 100;
    return {
      type: "saving",
      title: "Najwiekszy dzwignik",
      body: `${topCategory[0]} odpowiada teraz za ${clampPercent(share)}% wydatkow miesiaca (${formatPln(topCategory[1])} z ${formatPln(currentTotal)}). Nawet niewielkie ciecie w tej jednej kategorii da wiekszy efekt niz rozpraszanie oszczednosci po drobnych zakupach.`,
      emoji: "💡",
      severity: share >= 35 ? "warning" : "info",
    };
  }

  return {
    type: "saving",
    title: "Za malo danych trendu",
    body: "Historia jest jeszcze zbyt plytka, zeby lapac mocne odchylenia miesiac do miesiaca. Na razie najwiecej wartosci da dalsze zbieranie paragonow i porownanie pelnych miesiecy.",
    emoji: "🧠",
    severity: "info",
  };
}

function ensureThreeInsights(insights: Insight[]): Insight[] {
  const unique = insights.filter((insight, index, array) =>
    array.findIndex((candidate) => candidate.title === insight.title && candidate.type === insight.type) === index
  );

  const fallbacks: Insight[] = [
    {
      type: "saving",
      title: "Pilnuj powtarzalnosci",
      body: "Najbardziej uzyteczne wnioski pojawiaja sie wtedy, gdy paragony sa dodawane regularnie przez caly miesiac. Stabilnosc danych jest wazniejsza niz jednorazowo duza liczba wpisow.",
      emoji: "🗂️",
      severity: "info",
    },
    {
      type: "prediction",
      title: "Patrz na tempo tygodnia",
      body: "Jesli chcecie szybciej wykrywac odchylenia, porownujcie nie tylko miesiace, ale tez tygodniowe tempo wydatkow. To zwykle szybciej pokazuje, czy jedna kategoria zaczyna uciekac.",
      emoji: "📅",
      severity: "info",
    },
  ];

  for (const fallback of fallbacks) {
    if (unique.length >= 3) break;
    unique.push(fallback);
  }

  return unique.slice(0, 3);
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
    const currentMonthKey = getMonthKey(now);
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
    const dayOfMonth = now.getDate();

    const byMonth = buildMonthlyCategoryMap(args.expenses as ExpenseRow[]);
    const budgetMap = buildBudgetMap(args.budgets as BudgetRow[]);
    const sortedMonths = [...byMonth.keys()].sort();
    const currentMonthMap = byMonth.get(currentMonthKey) ?? new Map<string, number>();
    const previousMonths = sortedMonths.filter((month) => month < currentMonthKey).slice(-2);
    const previousMonthMap = previousMonths.length > 0
      ? byMonth.get(previousMonths[previousMonths.length - 1]) ?? new Map<string, number>()
      : new Map<string, number>();

    const currentTotal = [...currentMonthMap.values()].reduce((sum, value) => sum + value, 0);
    const previousTotal = [...previousMonthMap.values()].reduce((sum, value) => sum + value, 0);

    const insights = ensureThreeInsights([
      makePredictionInsight(currentTotal, previousTotal, dayOfMonth, daysInMonth),
      makeBudgetInsight(currentMonthMap, budgetMap, dayOfMonth, daysInMonth),
      makeTrendInsight(currentMonthMap, previousMonths, byMonth, currentTotal),
    ]);

    return insights;
  },
});
