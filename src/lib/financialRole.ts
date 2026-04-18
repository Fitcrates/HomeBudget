/**
 * Shared financial role helpers — extracted from HouseholdScreen, BudgetSettingsScreen, ProfileSettingsScreen.
 */

export type FinancialRole = "parent" | "partner" | "child";

export function financialRoleLabel(role?: FinancialRole): string {
  switch (role) {
    case "parent":
      return "Rodzic";
    case "child":
      return "Dziecko";
    default:
      return "Partner";
  }
}

/** Returns StatusBadge variant for the given financial role */
export function financialRoleBadgeVariant(role?: FinancialRole): "parent" | "partner" | "child" {
  return role ?? "partner";
}
