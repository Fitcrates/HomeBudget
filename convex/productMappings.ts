import { v } from "convex/values";
import { mutation, query, internalQuery } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { assertMember } from "./households";

// ── Internal: Lookup mapping during OCR process ───────────────────

export const lookupMapping = internalQuery({
  args: {
    householdId: v.id("households"),
    rawDescription: v.string(),
  },
  handler: async (ctx, args) => {
    // Exact match lookup, could be expanded to fuzzy later via search index
    const mapping = await ctx.db
      .query("product_mappings")
      .withIndex("by_household_and_raw", (q) =>
        q.eq("householdId", args.householdId).eq("rawDescription", args.rawDescription)
      )
      .unique();

    if (!mapping) return null;

    // Return the mapping, and touch the lastUsedAt behind the scenes if needed
    // (Queries can't mutate, so we'd have to fire an internal action/mutation if we wanted to bump usage async,
    // but for now, returning the cached match is the core need).
    return mapping;
  },
});

export const lookupMappingsBatch = internalQuery({
  args: {
    householdId: v.id("households"),
    rawDescriptions: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const uniqueDescriptions = [...new Set(args.rawDescriptions.map((value) => value.trim()).filter(Boolean))];
    if (uniqueDescriptions.length === 0) {
      return [];
    }

    const results = await Promise.all(
      uniqueDescriptions.map(async (rawDescription) => {
        const mapping = await ctx.db
          .query("product_mappings")
          .withIndex("by_household_and_raw", (q) =>
            q.eq("householdId", args.householdId).eq("rawDescription", rawDescription)
          )
          .unique();

        if (!mapping) return null;
        return {
          rawDescription,
          mapping,
        };
      })
    );

    return results.filter((entry): entry is NonNullable<typeof entry> => entry !== null);
  },
});

// ── Public: upsert mapping when user corrects in UI ───────────────

export const upsertMapping = mutation({
  args: {
    householdId: v.id("households"),
    rawDescription: v.string(),
    correctedDescription: v.string(),
    categoryId: v.id("categories"),
    subcategoryId: v.id("subcategories"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await assertMember(ctx, args.householdId, userId);

    if (!args.rawDescription || !args.correctedDescription) return;

    const existing = await ctx.db
      .query("product_mappings")
      .withIndex("by_household_and_raw", (q) =>
        q.eq("householdId", args.householdId).eq("rawDescription", args.rawDescription)
      )
      .unique();

    if (existing) {
      // Overwrite with latest user correction and bump usage
      await ctx.db.patch(existing._id, {
        correctedDescription: args.correctedDescription,
        categoryId: args.categoryId,
        subcategoryId: args.subcategoryId,
        usageCount: existing.usageCount + 1,
        lastUsedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("product_mappings", {
        householdId: args.householdId,
        rawDescription: args.rawDescription,
        correctedDescription: args.correctedDescription,
        categoryId: args.categoryId,
        subcategoryId: args.subcategoryId,
        usageCount: 1,
        lastUsedAt: Date.now(),
      });
    }
  },
});
