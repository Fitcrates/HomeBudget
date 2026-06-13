import type { Doc } from "../../_generated/dataModel";
import type { SpendingProfile } from "../types";
import { getStaticTemplate, type StaticMessageTemplate } from "./templates";

function formatMoney(cents: number, currency: string) {
  return `${Math.round(cents / 100)} ${currency}`;
}

export function renderTemplate(
  template: StaticMessageTemplate,
  variables: Record<string, string | number>
) {
  for (const required of template.requiredVariables) {
    if (variables[required] === undefined) {
      throw new Error(`Missing message variable: ${required}`);
    }
  }

  const replace = (value: string) =>
    value.replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, key) => String(variables[key] ?? ""));

  return {
    title: replace(template.titleTemplate),
    body: replace(template.bodyTemplate),
  };
}

export function renderOfferMessage(args: {
  offer: Doc<"offers">;
  profile: SpendingProfile;
  matchedCategoryKeys: string[];
  locale?: string;
}) {
  const category =
    args.profile.categoryStats.find((stat) => args.matchedCategoryKeys.includes(stat.categoryKey)) ??
    args.profile.categoryStats[0];
  const template = getStaticTemplate(
    args.offer.segmentKeys.includes("SUBSCRIPTION_HEAVY") ? "subscription" : "category_savings",
    args.locale ?? "pl-PL"
  );

  return renderTemplate(template, {
    categoryName: category?.categoryName ?? "wydatkach",
    monthlySpend: formatMoney(category?.monthlyAverage ?? 0, args.profile.currency),
    merchantName: args.offer.merchantName,
    estimatedSavings: formatMoney(args.offer.estimatedSavingsAmount ?? 0, args.profile.currency),
  });
}
