import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { assertWithinPersonalBudgetLimit } from "./budgets";
import { assertMember } from "./households";

const INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateInviteCode(length = 8) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => INVITE_ALPHABET[byte % INVITE_ALPHABET.length]).join("");
}

async function generateUniqueInviteCode(ctx: any) {
  for (let attempt = 0; attempt < 10; attempt++) {
    const inviteCode = generateInviteCode();
    const existing = await ctx.db
      .query("trips")
      .withIndex("by_invite_code", (q: any) => q.eq("inviteCode", inviteCode))
      .first();
    if (!existing) return inviteCode;
  }
  throw new Error("Nie udało się wygenerować kodu wyjazdu.");
}

async function getUserDisplayName(ctx: any, userId: any) {
  const [user, profile] = await Promise.all([
    ctx.db.get(userId),
    ctx.db.query("user_profiles").withIndex("by_user", (q: any) => q.eq("userId", userId)).unique(),
  ]);
  return (
    profile?.displayName ||
    user?.name ||
    (typeof user?.email === "string" ? user.email.split("@")[0] : "") ||
    "Uczestnik"
  );
}

async function assertTripMember(ctx: any, tripId: any, userId: any) {
  const member = await ctx.db
    .query("trip_members")
    .withIndex("by_trip_and_user", (q: any) => q.eq("tripId", tripId).eq("userId", userId))
    .unique();
  if (!member || member.status !== "active") {
    throw new Error("Nie masz dostępu do tego wyjazdu.");
  }
  return member;
}

async function assertTripOwner(ctx: any, tripId: any, userId: any) {
  const member = await assertTripMember(ctx, tripId, userId);
  if (member.role !== "owner") throw new Error("Tylko organizator może zarządzać uczestnikami.");
  return member;
}

function calculateLedger(members: any[], expenses: any[]) {
  const paid = new Map<string, number>();
  const owed = new Map<string, number>();

  for (const member of members) {
    paid.set(String(member._id), 0);
    owed.set(String(member._id), 0);
  }

  for (const expense of expenses) {
    const payerId = String(expense.paidByMemberId);
    paid.set(payerId, (paid.get(payerId) ?? 0) + expense.amount);

    const participantIds = expense.participantIds.map(String);
    if (participantIds.length === 0) continue;
    const baseShare = Math.floor(expense.amount / participantIds.length);
    const remainder = expense.amount - baseShare * participantIds.length;
    participantIds.forEach((participantId: string, index: number) => {
      owed.set(participantId, (owed.get(participantId) ?? 0) + baseShare + (index < remainder ? 1 : 0));
    });
  }

  const balances = members.map((member) => {
    const memberId = String(member._id);
    const paidAmount = paid.get(memberId) ?? 0;
    const owedAmount = owed.get(memberId) ?? 0;
    return { memberId: member._id, paid: paidAmount, owed: owedAmount, balance: paidAmount - owedAmount };
  });

  const creditors = balances
    .filter((item) => item.balance > 0)
    .map((item) => ({ ...item }))
    .sort((a, b) => b.balance - a.balance);
  const debtors = balances
    .filter((item) => item.balance < 0)
    .map((item) => ({ ...item, debt: -item.balance }))
    .sort((a, b) => b.debt - a.debt);
  const settlements: Array<{ fromMemberId: any; toMemberId: any; amount: number }> = [];

  let creditorIndex = 0;
  let debtorIndex = 0;
  while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
    const creditor = creditors[creditorIndex];
    const debtor = debtors[debtorIndex];
    const amount = Math.min(creditor.balance, debtor.debt);
    if (amount > 0) {
      settlements.push({ fromMemberId: debtor.memberId, toMemberId: creditor.memberId, amount });
      creditor.balance -= amount;
      debtor.debt -= amount;
    }
    if (creditor.balance === 0) creditorIndex++;
    if (debtor.debt === 0) debtorIndex++;
  }

  return { balances, settlements };
}

export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const memberships = await ctx.db
      .query("trip_members")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const trips = await Promise.all(
      memberships
        .filter((membership) => membership.status === "active")
        .map(async (membership) => {
          const trip = await ctx.db.get(membership.tripId);
          if (!trip) return null;
          const members = await ctx.db
            .query("trip_members")
            .withIndex("by_trip", (q) => q.eq("tripId", trip._id))
            .collect();
          return { ...trip, role: membership.role, memberCount: members.length };
        })
    );
    return trips.filter(Boolean).sort((a: any, b: any) => b.createdAt - a.createdAt);
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    currency: v.optional(v.string()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const name = args.name.trim();
    if (!name) throw new Error("Podaj nazwę wyjazdu.");
    const inviteCode = await generateUniqueInviteCode(ctx);
    const tripId = await ctx.db.insert("trips", {
      name,
      currency: args.currency?.trim().toUpperCase() || "PLN",
      createdByUserId: userId,
      inviteCode,
      status: "active",
      startDate: args.startDate,
      endDate: args.endDate,
      createdAt: Date.now(),
    });
    const user = await ctx.db.get(userId);
    await ctx.db.insert("trip_members", {
      tripId,
      userId,
      email: typeof user?.email === "string" ? user.email.toLowerCase() : undefined,
      displayName: await getUserDisplayName(ctx, userId),
      role: "owner",
      status: "active",
      createdAt: Date.now(),
      joinedAt: Date.now(),
    });
    return tripId;
  },
});

export const joinByCode = mutation({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const code = args.code.trim().toUpperCase();
    const trip = await ctx.db
      .query("trips")
      .withIndex("by_invite_code", (q) => q.eq("inviteCode", code))
      .unique();
    if (!trip) throw new Error("Nieprawidłowy kod wyjazdu.");
    if (trip.status !== "active") throw new Error("Ten wyjazd jest już zamknięty.");

    const existing = await ctx.db
      .query("trip_members")
      .withIndex("by_trip_and_user", (q) => q.eq("tripId", trip._id).eq("userId", userId))
      .unique();
    if (existing) return trip._id;

    const user = await ctx.db.get(userId);
    const email = typeof user?.email === "string" ? user.email.toLowerCase() : undefined;
    const invited = email
      ? await ctx.db
          .query("trip_members")
          .withIndex("by_trip_and_email", (q) => q.eq("tripId", trip._id).eq("email", email))
          .unique()
      : null;

    if (invited && !invited.userId) {
      await ctx.db.patch(invited._id, {
        userId,
        displayName: await getUserDisplayName(ctx, userId),
        status: "active",
        joinedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("trip_members", {
        tripId: trip._id,
        userId,
        email,
        displayName: await getUserDisplayName(ctx, userId),
        role: "member",
        status: "active",
        createdAt: Date.now(),
        joinedAt: Date.now(),
      });
    }
    return trip._id;
  },
});

export const getDetails = query({
  args: { tripId: v.id("trips") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const myMember = await assertTripMember(ctx, args.tripId, userId);
    const [trip, members, expenses, tripExport] = await Promise.all([
      ctx.db.get(args.tripId),
      ctx.db.query("trip_members").withIndex("by_trip", (q) => q.eq("tripId", args.tripId)).collect(),
      ctx.db.query("trip_expenses").withIndex("by_trip_and_date", (q) => q.eq("tripId", args.tripId)).order("desc").collect(),
      ctx.db.query("trip_exports").withIndex("by_trip_and_user", (q) => q.eq("tripId", args.tripId).eq("userId", userId)).unique(),
    ]);
    if (!trip) throw new Error("Wyjazd nie istnieje.");
    const ledger = calculateLedger(members, expenses);
    const myBalance = ledger.balances.find((item) => item.memberId === myMember._id);
    return {
      trip,
      members,
      expenses,
      balances: ledger.balances,
      settlements: ledger.settlements,
      myMemberId: myMember._id,
      myRole: myMember.role,
      myShare: myBalance?.owed ?? 0,
      exportedAmount: tripExport?.amount ?? null,
    };
  },
});

export const addGuest = mutation({
  args: { tripId: v.id("trips"), displayName: v.string(), email: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await assertTripOwner(ctx, args.tripId, userId);
    const displayName = args.displayName.trim();
    const email = args.email?.trim().toLowerCase() || undefined;
    if (!displayName) throw new Error("Podaj imię uczestnika.");
    if (email) {
      const existing = await ctx.db
        .query("trip_members")
        .withIndex("by_trip_and_email", (q) => q.eq("tripId", args.tripId).eq("email", email))
        .unique();
      if (existing) throw new Error("Ta osoba jest już na liście wyjazdu.");
    }
    return await ctx.db.insert("trip_members", {
      tripId: args.tripId,
      email,
      displayName,
      role: "member",
      status: email ? "invited" : "active",
      createdAt: Date.now(),
    });
  },
});

export const createExpense = mutation({
  args: {
    tripId: v.id("trips"),
    paidByMemberId: v.id("trip_members"),
    participantIds: v.array(v.id("trip_members")),
    amount: v.number(),
    date: v.number(),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await assertTripMember(ctx, args.tripId, userId);
    const trip = await ctx.db.get(args.tripId);
    if (!trip || trip.status !== "active") throw new Error("Ten wyjazd jest zamknięty.");
    if (!Number.isInteger(args.amount) || args.amount <= 0) throw new Error("Kwota musi być większa od zera.");
    if (!args.description.trim()) throw new Error("Podaj opis wydatku.");
    const participantIds = Array.from(new Set(args.participantIds.map(String)));
    if (participantIds.length === 0) throw new Error("Wybierz co najmniej jednego uczestnika.");
    const memberIds = [String(args.paidByMemberId), ...participantIds];
    const members = (await Promise.all(
      memberIds.map((memberId) => ctx.db.get(memberId as Id<"trip_members">))
    )) as Array<{ tripId: Id<"trips"> } | null>;
    if (members.some((member) => !member || String(member.tripId) !== String(args.tripId))) {
      throw new Error("Uczestnik nie należy do tego wyjazdu.");
    }
    return await ctx.db.insert("trip_expenses", {
      tripId: args.tripId,
      createdByUserId: userId,
      paidByMemberId: args.paidByMemberId,
      participantIds: participantIds as any,
      amount: args.amount,
      date: args.date,
      description: args.description.trim(),
      createdAt: Date.now(),
    });
  },
});

export const removeExpense = mutation({
  args: { expenseId: v.id("trip_expenses") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const expense = await ctx.db.get(args.expenseId);
    if (!expense) return;
    const member = await assertTripMember(ctx, expense.tripId, userId);
    if (expense.createdByUserId !== userId && member.role !== "owner") {
      throw new Error("Możesz usunąć tylko własny wydatek.");
    }
    await ctx.db.delete(args.expenseId);
  },
});

export const exportMyShare = mutation({
  args: {
    tripId: v.id("trips"),
    householdId: v.id("households"),
    categoryId: v.id("categories"),
    subcategoryId: v.id("subcategories"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const myMember = await assertTripMember(ctx, args.tripId, userId);
    await assertMember(ctx, args.householdId, userId);
    const [trip, members, tripExpenses, category, subcategory] = await Promise.all([
      ctx.db.get(args.tripId),
      ctx.db.query("trip_members").withIndex("by_trip", (q) => q.eq("tripId", args.tripId)).collect(),
      ctx.db.query("trip_expenses").withIndex("by_trip", (q) => q.eq("tripId", args.tripId)).collect(),
      ctx.db.get(args.categoryId),
      ctx.db.get(args.subcategoryId),
    ]);
    if (!trip) throw new Error("Wyjazd nie istnieje.");
    if (!category || !subcategory || subcategory.categoryId !== category._id) {
      throw new Error("Wybierz prawidłową kategorię i podkategorię.");
    }
    if (!category.isSystem && category.householdId !== args.householdId) {
      throw new Error("Kategoria nie należy do aktywnego domostwa.");
    }
    if (!subcategory.isSystem && subcategory.householdId !== args.householdId) {
      throw new Error("Podkategoria nie należy do aktywnego domostwa.");
    }
    const ledger = calculateLedger(members, tripExpenses);
    const amount = ledger.balances.find((item) => item.memberId === myMember._id)?.owed ?? 0;
    if (amount <= 0) throw new Error("Brak udziału do wyeksportowania.");
    const existing = await ctx.db
      .query("trip_exports")
      .withIndex("by_trip_and_user", (q) => q.eq("tripId", args.tripId).eq("userId", userId))
      .unique();
    const exportDate = trip.endDate ?? Date.now();
    await assertWithinPersonalBudgetLimit(ctx, {
      householdId: args.householdId,
      userId,
      date: exportDate,
      amountDelta: amount,
      excludeExpenseId: existing?.expenseId,
    });
    const expenseData = {
      householdId: args.householdId,
      userId,
      categoryId: args.categoryId,
      subcategoryId: args.subcategoryId,
      amount,
      date: exportDate,
      description: `Wyjazd: ${trip.name}`,
      tags: ["wyjazd", trip.name],
    };

    if (existing) {
      const expense = await ctx.db.get(existing.expenseId);
      if (expense) {
        await ctx.db.patch(existing.expenseId, expenseData);
        await ctx.db.patch(existing._id, { householdId: args.householdId, amount, exportedAt: Date.now() });
      } else {
        const expenseId = await ctx.db.insert("expenses", expenseData);
        await ctx.db.patch(existing._id, { householdId: args.householdId, expenseId, amount, exportedAt: Date.now() });
        await ctx.db.patch(expenseId, { sourceTripExportId: existing._id });
      }
    } else {
      const expenseId = await ctx.db.insert("expenses", expenseData);
      const exportId = await ctx.db.insert("trip_exports", {
        tripId: args.tripId,
        userId,
        householdId: args.householdId,
        expenseId,
        amount,
        exportedAt: Date.now(),
      });
      await ctx.db.patch(expenseId, { sourceTripExportId: exportId });
    }

    await ctx.runMutation(internal.offers.segments.jobs.markHouseholdDirty, {
      householdId: args.householdId,
      reason: "trip_share_exported",
    });
    return amount;
  },
});
