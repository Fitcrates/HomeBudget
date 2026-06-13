import type { Id } from "../../_generated/dataModel";
import {
  DEFAULT_PROFILE_WINDOW_DAYS,
  type SegmentEvaluation,
  type SpendingProfile,
} from "../types";
import { segmentRules } from "./rules";

export type ExpenseForProfile = {
  amount: number;
  date: number;
  categoryId: Id<"categories">;
  categoryName: string;
};

export function toCategoryKey(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "unknown";
}

function makeDataHash(expenses: ExpenseForProfile[]) {
  const basis = expenses
    .map((expense) => `${expense.categoryId}:${expense.amount}:${expense.date}`)
    .sort()
    .join("|");
  let hash = 0;
  for (let i = 0; i < basis.length; i++) {
    hash = (hash * 31 + basis.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16);
}

export function buildSpendingProfile(args: {
  householdId: Id<"households">;
  currency: string;
  expenses: ExpenseForProfile[];
  now: number;
  windowDays?: number;
}): SpendingProfile {
  const windowDays = args.windowDays ?? DEFAULT_PROFILE_WINDOW_DAYS;
  const dataFrom = args.now - windowDays * 24 * 60 * 60 * 1000;
  const months = windowDays / 30;
  const byCategory = new Map<string, {
    categoryId: Id<"categories">;
    categoryName: string;
    categoryKey: string;
    totalAmount: number;
    transactionCount: number;
  }>();

  for (const expense of args.expenses) {
    if (expense.date < dataFrom || expense.date > args.now) continue;
    const key = String(expense.categoryId);
    const existing = byCategory.get(key) ?? {
      categoryId: expense.categoryId,
      categoryName: expense.categoryName,
      categoryKey: toCategoryKey(expense.categoryName),
      totalAmount: 0,
      transactionCount: 0,
    };
    existing.totalAmount += expense.amount;
    existing.transactionCount += 1;
    byCategory.set(key, existing);
  }

  const categoryStats = [...byCategory.values()]
    .map((stat) => ({
      ...stat,
      monthlyAverage: Math.round(stat.totalAmount / months),
      frequencyPerMonth: Number((stat.transactionCount / months).toFixed(2)),
    }))
    .sort((a, b) => b.monthlyAverage - a.monthlyAverage);

  return {
    householdId: args.householdId,
    windowDays,
    currency: args.currency,
    totalSpend: categoryStats.reduce((sum, stat) => sum + stat.totalAmount, 0),
    categoryStats,
    computedAt: args.now,
    dataFrom,
    dataTo: args.now,
    dataHash: makeDataHash(args.expenses),
  };
}

export function calculateSegments(profile: SpendingProfile): SegmentEvaluation[] {
  return segmentRules
    .map((rule) => rule.evaluate(profile))
    .filter(Boolean)
    .sort((a, b) => b!.score - a!.score) as SegmentEvaluation[];
}
