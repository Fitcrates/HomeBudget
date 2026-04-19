import type { Id } from "../_generated/dataModel";

type PendingEmailExpenseRow = {
  _id: Id<"pending_email_expenses">;
  householdId: Id<"households">;
  providerMessageId: string;
  storageIds?: Id<"_storage">[];
  status: "pending" | "approved" | "rejected";
  isProcessed?: boolean;
  processedExpenseIds?: Id<"expenses">[];
};

function uniqueExpenseIds(ids: Id<"expenses">[]) {
  return [...new Set(ids)];
}

export async function findLinkedExpenseIdsForPending(
  ctx: any,
  pending: PendingEmailExpenseRow
): Promise<Id<"expenses">[]> {
  if (pending.processedExpenseIds && pending.processedExpenseIds.length > 0) {
    return uniqueExpenseIds(pending.processedExpenseIds);
  }

  const directMatches = await ctx.db
    .query("expenses")
    .withIndex("by_source_pending_email_expense_id", (q: any) =>
      q.eq("sourcePendingEmailExpenseId", pending._id)
    )
    .collect();

  if (directMatches.length > 0) {
    return uniqueExpenseIds(directMatches.map((expense: any) => expense._id));
  }

  const providerMatches = await ctx.db
    .query("expenses")
    .withIndex("by_household_and_source_provider_message_id", (q: any) =>
      q
        .eq("householdId", pending.householdId)
        .eq("sourceProviderMessageId", pending.providerMessageId)
    )
    .collect();

  if (providerMatches.length > 0) {
    return uniqueExpenseIds(providerMatches.map((expense: any) => expense._id));
  }

  const fallbackMatches = new Set<Id<"expenses">>();
  for (const storageId of pending.storageIds ?? []) {
    const expensesForReceipt = await ctx.db
      .query("expenses")
      .withIndex("by_household_and_receipt_image_id", (q: any) =>
        q.eq("householdId", pending.householdId).eq("receiptImageId", storageId)
      )
      .collect();

    for (const expense of expensesForReceipt) {
      fallbackMatches.add(expense._id);
    }
  }

  return uniqueExpenseIds([...fallbackMatches]);
}

export async function listEffectivelyPendingEmailExpenses(
  ctx: any,
  householdId: Id<"households">
) {
  const rows = await ctx.db
    .query("pending_email_expenses")
    .withIndex("by_household_and_status", (q: any) =>
      q.eq("householdId", householdId).eq("status", "pending")
    )
    .order("desc")
    .collect();

  const rowsWithLinkedExpenses = await Promise.all(
    rows.map(async (row: any) => ({
      row,
      linkedExpenseIds: await findLinkedExpenseIdsForPending(ctx, row),
    }))
  );

  return rowsWithLinkedExpenses
    .filter(({ row, linkedExpenseIds }) => row.isProcessed !== true && linkedExpenseIds.length === 0)
    .map(({ row }) => row);
}
