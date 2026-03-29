import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";

function generateInviteCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export const create = mutation({
  args: { name: v.string(), currency: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const inviteCode = generateInviteCode();
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
        return h ? { ...h, role: m.role } : null;
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
        return { ...m, user };
      })
    );
  },
});

export const regenerateInviteCode = mutation({
  args: { householdId: v.id("households") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await assertOwner(ctx, args.householdId, userId);
    const newCode = generateInviteCode();
    await ctx.db.patch(args.householdId, { inviteCode: newCode });
    return newCode;
  },
});

export const joinByCode = mutation({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const household = await ctx.db
      .query("households")
      .withIndex("by_invite_code", (q) => q.eq("inviteCode", args.code.toUpperCase()))
      .unique();

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
      });
    }

    await ctx.db.patch(invitation._id, { status: "accepted" });
    return invitation.householdId;
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
