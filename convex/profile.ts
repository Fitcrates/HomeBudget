import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const getMyProfile = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const user = await ctx.db.get(userId);
    const profile = await ctx.db
      .query("user_profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    const avatarUrl = profile?.avatarImageId
      ? await ctx.storage.getUrl(profile.avatarImageId)
      : null;

    return {
      userId,
      email: typeof user?.email === "string" ? user.email : "",
      displayName: profile?.displayName ?? "",
      avatarImageId: profile?.avatarImageId ?? null,
      avatarUrl,
    };
  },
});

export const updateMyProfile = mutation({
  args: {
    displayName: v.string(),
    avatarImageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const current = await ctx.db
      .query("user_profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    const cleanName = args.displayName.trim();

    if (!current) {
      await ctx.db.insert("user_profiles", {
        userId,
        displayName: cleanName || undefined,
        avatarImageId: args.avatarImageId,
        updatedAt: Date.now(),
      });
      return;
    }

    await ctx.db.patch(current._id, {
      displayName: cleanName || undefined,
      avatarImageId:
        args.avatarImageId === undefined ? current.avatarImageId : args.avatarImageId,
      updatedAt: Date.now(),
    });
  },
});

export const removeAvatar = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const current = await ctx.db
      .query("user_profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (!current) return;
    await ctx.db.patch(current._id, {
      avatarImageId: undefined,
      updatedAt: Date.now(),
    });
  },
});

export const generateAvatarUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    return await ctx.storage.generateUploadUrl();
  },
});
