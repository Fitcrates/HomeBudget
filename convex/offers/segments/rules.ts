import type { SegmentEvaluation, SegmentKey, SpendingProfile } from "../types";

export type SegmentRule = {
  key: SegmentKey;
  evaluate(profile: SpendingProfile): SegmentEvaluation | null;
};

function findStat(profile: SpendingProfile, patterns: RegExp[]) {
  return profile.categoryStats.filter((stat) =>
    patterns.some((pattern) => pattern.test(stat.categoryKey) || pattern.test(stat.categoryName.toLowerCase()))
  );
}

function sumStats(stats: ReturnType<typeof findStat>) {
  return stats.reduce(
    (acc, stat) => ({
      monthlyAverage: acc.monthlyAverage + stat.monthlyAverage,
      transactionCount: acc.transactionCount + stat.transactionCount,
      categoryKeys: [...acc.categoryKeys, stat.categoryKey],
    }),
    { monthlyAverage: 0, transactionCount: 0, categoryKeys: [] as string[] }
  );
}

function makeEvaluation(
  key: SegmentKey,
  profile: SpendingProfile,
  data: { monthlyAverage: number; transactionCount: number; categoryKeys: string[] },
  thresholdAmount: number,
  thresholdCount: number
): SegmentEvaluation | null {
  if (data.monthlyAverage < thresholdAmount && data.transactionCount < thresholdCount) return null;

  const amountScore = Math.min(70, (data.monthlyAverage / Math.max(thresholdAmount, 1)) * 45);
  const countScore = Math.min(30, (data.transactionCount / Math.max(thresholdCount, 1)) * 20);

  return {
    segmentKey: key,
    score: Math.min(100, Math.round(amountScore + countScore)),
    evidence: {
      windowDays: profile.windowDays,
      monthlyAverage: Math.round(data.monthlyAverage),
      transactionCount: data.transactionCount,
      categoryKeys: [...new Set(data.categoryKeys)],
    },
  };
}

export const segmentRules: SegmentRule[] = [
  {
    key: "HIGH_FOOD",
    evaluate(profile) {
      const data = sumStats(findStat(profile, [/food/, /zywnosc/, /jedzenie/, /grocery/, /spożyw/, /spozyw/]));
      return makeEvaluation("HIGH_FOOD", profile, data, 120000, 12);
    },
  },
  {
    key: "DELIVERY_HEAVY",
    evaluate(profile) {
      const data = sumStats(findStat(profile, [/delivery/, /dostaw/, /restaur/, /pizza/, /sushi/, /fast/]));
      return makeEvaluation("DELIVERY_HEAVY", profile, data, 40000, 6);
    },
  },
  {
    key: "FUEL_SPENDER",
    evaluate(profile) {
      const data = sumStats(findStat(profile, [/fuel/, /paliw/, /transport/, /auto/, /samoch/]));
      return makeEvaluation("FUEL_SPENDER", profile, data, 45000, 4);
    },
  },
  {
    key: "SUBSCRIPTION_HEAVY",
    evaluate(profile) {
      const data = sumStats(findStat(profile, [/subscription/, /subsk/, /stream/, /abonament/]));
      return makeEvaluation("SUBSCRIPTION_HEAVY", profile, data, 8000, 2);
    },
  },
  {
    key: "ONLINE_SHOPPER",
    evaluate(profile) {
      const data = sumStats(findStat(profile, [/online/, /commerce/, /marketplace/, /zakup/, /sklep/]));
      return makeEvaluation("ONLINE_SHOPPER", profile, data, 50000, 5);
    },
  },
];
