import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";

export type FinancialRole = "parent" | "partner" | "child";

const HOUSEHOLD_INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const HOUSEHOLD_INVITE_CODE_LENGTH = 8;
const HOUSEHOLD_INVITE_MAX_ATTEMPTS = 10;

function generateInviteCode(length = HOUSEHOLD_INVITE_CODE_LENGTH): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);

  let code = "";
  for (const byte of bytes) {
    code += HOUSEHOLD_INVITE_ALPHABET[byte % HOUSEHOLD_INVITE_ALPHABET.length];
  }
  return code;
}

async function generateUniqueHouseholdInviteCode(ctx: any): Promise<string> {
  for (let attempt = 0; attempt < HOUSEHOLD_INVITE_MAX_ATTEMPTS; attempt++) {
    const inviteCode = generateInviteCode();
    const existing = await ctx.db
      .query("households")
      .withIndex("by_invite_code", (q: any) => q.eq("inviteCode", inviteCode))
      .first();

    if (!existing) {
      return inviteCode;
    }
  }

  throw new Error("Nie udało się wygenerować unikalnego kodu zaproszenia.");
}

export function getEffectiveFinancialRole(membership: {
  role: "owner" | "member";
  financialRole?: FinancialRole;
}): FinancialRole {
  if (membership.role === "owner") return "parent";
  return membership.financialRole ?? "partner";
}

export const create = mutation({
  args: { name: v.string(), currency: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const inviteCode = await generateUniqueHouseholdInviteCode(ctx);
    const householdId = await ctx.db.insert("households", {
      name: args.name,
      ownerId: userId,
      currency: args.currency ?? "PLN",
      inviteCode,
    });

    await ctx.db.insert("memberships", {
      householdId,
      userId,
      role: "owner",
      financialRole: "parent",
    });

    // Seed default categories for this household
    await ctx.scheduler.runAfter(0, internal.seed.seedDefaultCategories, {
      householdId,
    });

    return householdId;
  },
});

export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const households = await Promise.all(
      memberships.map(async (m) => {
        const h = await ctx.db.get(m.householdId);
        return h ? { ...h, role: m.role, financialRole: getEffectiveFinancialRole(m as any) } : null;
      })
    );

    return households.filter(Boolean);
  },
});

export const get = query({
  args: { householdId: v.id("households") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await assertMember(ctx, args.householdId, userId);
    return await ctx.db.get(args.householdId);
  },
});

export const getMembers = query({
  args: { householdId: v.id("households") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await assertMember(ctx, args.householdId, userId);

    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_household", (q) => q.eq("householdId", args.householdId))
      .collect();

    return Promise.all(
      memberships.map(async (m) => {
        const user = await ctx.db.get(m.userId);
        const profile = await ctx.db
          .query("user_profiles")
          .withIndex("by_user", (q) => q.eq("userId", m.userId))
          .unique();
        const avatarUrl = profile?.avatarImageId
          ? await ctx.storage.getUrl(profile.avatarImageId)
          : null;
        const displayName =
          profile?.displayName ||
          user?.name ||
          (typeof user?.email === "string" ? user.email.split("@")[0] : "") ||
          "Nieznany";

        return {
          ...m,
          financialRole: getEffectiveFinancialRole(m as any),
          user,
          profile,
          avatarUrl,
          displayName,
        };
      })
    );
  },
});

export const getMyMembership = query({
  args: { householdId: v.id("households") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const membership = await assertMember(ctx, args.householdId, userId);
    return {
      ...membership,
      financialRole: getEffectiveFinancialRole(membership as any),
    };
  },
});

export const regenerateInviteCode = mutation({
  args: { householdId: v.id("households") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await assertOwner(ctx, args.householdId, userId);
    const newCode = await generateUniqueHouseholdInviteCode(ctx);
    await ctx.db.patch(args.householdId, { inviteCode: newCode });
    return newCode;
  },
});

export const joinByCode = mutation({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const normalizedCode = args.code.trim().toUpperCase();

    const household = await ctx.db
      .query("households")
      .withIndex("by_invite_code", (q) => q.eq("inviteCode", normalizedCode))
      .first();

    if (!household) throw new Error("Invalid invite code");

    const existing = await ctx.db
      .query("memberships")
      .withIndex("by_household_and_user", (q) =>
        q.eq("householdId", household._id).eq("userId", userId)
      )
      .unique();

    if (existing) throw new Error("Already a member");

    await ctx.db.insert("memberships", {
      householdId: household._id,
      userId,
      role: "member",
      financialRole: "partner",
    });

    return household._id;
  },
});

export const removeMember = mutation({
  args: { householdId: v.id("households"), targetUserId: v.id("users") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await assertOwner(ctx, args.householdId, userId);

    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_household_and_user", (q) =>
        q.eq("householdId", args.householdId).eq("userId", args.targetUserId)
      )
      .unique();

    if (!membership) throw new Error("Member not found");
    if (membership.role === "owner") throw new Error("Cannot remove owner");

    const personBudget = await ctx.db
      .query("person_budgets")
      .withIndex("by_household_and_user", (q) =>
        q.eq("householdId", args.householdId).eq("userId", args.targetUserId)
      )
      .unique();
    if (personBudget) {
      await ctx.db.delete(personBudget._id);
    }

    await ctx.db.delete(membership._id);
  },
});

export const inviteByEmail = mutation({
  args: { householdId: v.id("households"), email: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await assertMember(ctx, args.householdId, userId);

    const code = Math.random().toString(36).substring(2, 10).toUpperCase();
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days

    await ctx.db.insert("invitations", {
      householdId: args.householdId,
      invitedByUserId: userId,
      email: args.email.toLowerCase(),
      code,
      status: "pending",
      expiresAt,
    });

    return code;
  },
});

export const acceptInvitation = mutation({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const invitation = await ctx.db
      .query("invitations")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .unique();

    if (!invitation) throw new Error("Invitation not found");
    if (invitation.status !== "pending") throw new Error("Invitation already used");
    if (invitation.expiresAt < Date.now()) {
      await ctx.db.patch(invitation._id, { status: "expired" });
      throw new Error("Invitation expired");
    }

    const existing = await ctx.db
      .query("memberships")
      .withIndex("by_household_and_user", (q) =>
        q.eq("householdId", invitation.householdId).eq("userId", userId)
      )
      .unique();

    if (!existing) {
      await ctx.db.insert("memberships", {
        householdId: invitation.householdId,
        userId,
        role: "member",
        financialRole: "partner",
      });
    }

    await ctx.db.patch(invitation._id, { status: "accepted" });
    return invitation.householdId;
  },
});

export const updateFinancialRole = mutation({
  args: {
    householdId: v.id("households"),
    targetUserId: v.id("users"),
    financialRole: v.union(v.literal("parent"), v.literal("partner"), v.literal("child")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    await assertCanManageFinancialRoles(ctx, args.householdId, userId);

    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_household_and_user", (q) =>
        q.eq("householdId", args.householdId).eq("userId", args.targetUserId)
      )
      .unique();

    if (!membership) throw new Error("Member not found");
    if (membership.role === "owner") {
      throw new Error("Owner zawsze ma rolę finansową rodzica.");
    }

    await ctx.db.patch(membership._id, {
      financialRole: args.financialRole,
    });
  },
});

// Helpers
export async function assertMember(
  ctx: any,
  householdId: any,
  userId: any
) {
  const m = await ctx.db
    .query("memberships")
    .withIndex("by_household_and_user", (q: any) =>
      q.eq("householdId", householdId).eq("userId", userId)
    )
    .unique();
  if (!m) throw new Error("Not a member of this household");
  return m;
}

export async function assertOwner(
  ctx: any,
  householdId: any,
  userId: any
) {
  const m = await assertMember(ctx, householdId, userId);
  if (m.role !== "owner") throw new Error("Only owner can perform this action");
  return m;
}

export async function assertCanManageFinancialRoles(
  ctx: any,
  householdId: any,
  userId: any
) {
  const membership = await assertMember(ctx, householdId, userId);
  const effectiveFinancialRole = getEffectiveFinancialRole(membership);

  if (membership.role === "owner" || effectiveFinancialRole === "parent") {
    return membership;
  }

  throw new Error("Brak uprawnień do zarządzania rolami finansowymi.");
}

export async function assertCanManageSharedBudgets(
  ctx: any,
  householdId: any,
  userId: any
) {
  const membership = await assertMember(ctx, householdId, userId);
  const effectiveFinancialRole = getEffectiveFinancialRole(membership);

  if (
    membership.role === "owner" ||
    effectiveFinancialRole === "parent" ||
    effectiveFinancialRole === "partner"
  ) {
    return membership;
  }

  throw new Error("Brak uprawnień do zarządzania budżetami gospodarstwa.");
}
