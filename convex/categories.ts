import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { assertMember } from "./households";
import { internal } from "./_generated/api";

export const listForHousehold = query({
  args: { householdId: v.id("households") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await assertMember(ctx, args.householdId, userId);

    // System categories
    const systemCats = await ctx.db
      .query("categories")
      .withIndex("by_system", (q) => q.eq("isSystem", true))
      .collect();

    // Household-specific categories
    const householdCats = await ctx.db
      .query("categories")
      .withIndex("by_household", (q) => q.eq("householdId", args.householdId))
      .collect();

    const allCats = [...systemCats, ...householdCats].sort(
      (a, b) => a.sortOrder - b.sortOrder
    );

    // Attach subcategories
    return Promise.all(
      allCats.map(async (cat) => {
        const subs = await ctx.db
          .query("subcategories")
          .withIndex("by_category", (q) => q.eq("categoryId", cat._id))
          .collect();
        return { ...cat, subcategories: subs.sort((a, b) => a.sortOrder - b.sortOrder) };
      })
    );
  },
});

export const syncDefaultCatalog = mutation({
  args: {
    householdId: v.id("households"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await assertMember(ctx, args.householdId, userId);

    await ctx.runMutation(internal.seed.syncDefaultCategoriesForHousehold, {
      householdId: args.householdId,
    });

    return { ok: true };
  },
});

export const createCategory = mutation({
  args: {
    householdId: v.id("households"),
    name: v.string(),
    icon: v.string(),
    color: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await assertMember(ctx, args.householdId, userId);

    return await ctx.db.insert("categories", {
      householdId: args.householdId,
      name: args.name,
      icon: args.icon,
      color: args.color,
      isSystem: false,
      sortOrder: Date.now(),
    });
  },
});

export const updateCategory = mutation({
  args: {
    categoryId: v.id("categories"),
    householdId: v.id("households"),
    name: v.optional(v.string()),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await assertMember(ctx, args.householdId, userId);

    const cat = await ctx.db.get(args.categoryId);
    if (!cat) throw new Error("Category not found");
    if (cat.isSystem) throw new Error("Cannot edit system categories");

    const { categoryId, householdId, ...updates } = args;
    await ctx.db.patch(args.categoryId, updates);
  },
});

export const deleteCategory = mutation({
  args: {
    categoryId: v.id("categories"),
    householdId: v.id("households"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await assertMember(ctx, args.householdId, userId);

    const cat = await ctx.db.get(args.categoryId);
    if (!cat) throw new Error("Category not found");
    if (cat.isSystem) throw new Error("Cannot delete system categories");

    // Delete subcategories
    const subs = await ctx.db
      .query("subcategories")
      .withIndex("by_category", (q) => q.eq("categoryId", args.categoryId))
      .collect();
    for (const sub of subs) await ctx.db.delete(sub._id);

    await ctx.db.delete(args.categoryId);
  },
});

export const createSubcategory = mutation({
  args: {
    householdId: v.id("households"),
    categoryId: v.id("categories"),
    name: v.string(),
    icon: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await assertMember(ctx, args.householdId, userId);

    return await ctx.db.insert("subcategories", {
      categoryId: args.categoryId,
      householdId: args.householdId,
      name: args.name,
      icon: args.icon,
      isSystem: false,
      sortOrder: Date.now(),
    });
  },
});

export const updateSubcategory = mutation({
  args: {
    subcategoryId: v.id("subcategories"),
    householdId: v.id("households"),
    name: v.optional(v.string()),
    icon: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await assertMember(ctx, args.householdId, userId);

    const sub = await ctx.db.get(args.subcategoryId);
    if (!sub) throw new Error("Subcategory not found");
    if (sub.isSystem) throw new Error("Cannot edit system subcategories");

    const { subcategoryId, householdId, ...updates } = args;
    await ctx.db.patch(args.subcategoryId, updates);
  },
});

export const deleteSubcategory = mutation({
  args: {
    subcategoryId: v.id("subcategories"),
    householdId: v.id("households"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await assertMember(ctx, args.householdId, userId);

    const sub = await ctx.db.get(args.subcategoryId);
    if (!sub) throw new Error("Subcategory not found");
    if (sub.isSystem) throw new Error("Cannot delete system subcategories");

    await ctx.db.delete(args.subcategoryId);
  },
});
