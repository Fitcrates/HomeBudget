import type { ScoringStrategy } from "./types";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export const marginFirstStrategy: ScoringStrategy = {
  key: "margin_first_v1",
  score(input) {
    const segmentStrength = input.segments
      .filter((segment) => input.matchedSegments.includes(segment.segmentKey))
      .reduce((sum, segment) => sum + segment.score, 0);
    const matchedSpend = input.profile.categoryStats
      .filter((stat) => input.matchedCategoryKeys.includes(stat.categoryKey))
      .reduce((sum, stat) => sum + stat.monthlyAverage, 0);
    const revenueValue = input.offer.revenueModel === "cps"
      ? clamp((input.offer.commissionRate ?? 0) / 12, 0, 1)
      : clamp((input.offer.commissionAmount ?? 0) / 1500, 0, 1);

    const factors = [
      { key: "segment_match", value: clamp(segmentStrength / 100, 0, 1), weight: 25 },
      { key: "category_spend", value: clamp(matchedSpend / 180000, 0, 1), weight: 20 },
      { key: "revenue_potential", value: revenueValue, weight: 25 },
      { key: "source_priority", value: clamp(input.source.priorityBoost / 20, 0, 1), weight: 20 },
      {
        key: "savings_value",
        value: clamp((input.offer.estimatedSavingsAmount ?? 0) / 5000, 0, 1),
        weight: 10,
      },
    ];

    return {
      score: Math.round(factors.reduce((sum, factor) => sum + factor.value * factor.weight, 0)),
      factors,
    };
  },
};
