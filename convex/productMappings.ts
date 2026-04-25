import { v } from "convex/values";
import { mutation, query, internalQuery } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { assertMember } from "./households";

async function assertCategorySelectionForHousehold(
  ctx: any,
  householdId: unknown,
  categoryId: unknown,
  subcategoryId: unknown
) {
  const [category, subcategory] = await Promise.all([
    ctx.db.get(categoryId),
    ctx.db.get(subcategoryId),
  ]);

  if (!category || !subcategory) {
    throw new Error("Nieprawidlowa kategoria lub podkategoria.");
  }
  if (!category.isSystem && category.householdId !== householdId) {
    throw new Error("Kategoria nie nalezy do tego gospodarstwa.");
  }
  if (!subcategory.isSystem && subcategory.householdId !== householdId) {
    throw new Error("Podkategoria nie nalezy do tego gospodarstwa.");
  }
  if (subcategory.categoryId !== categoryId) {
    throw new Error("Podkategoria nie nalezy do wybranej kategorii.");
  }
}

// ── Internal: Lookup mapping during OCR process ───────────────────

export const lookupMapping = internalQuery({
  args: {
    householdId: v.id("households"),
    rawDescription: v.string(),
  },
  handler: async (ctx, args) => {
    // Exact match lookup, could be expanded to fuzzy later via search index
    const mappings = await ctx.db
      .query("product_mappings")
      .withIndex("by_household_and_raw", (q) =>
        q.eq("householdId", args.householdId).eq("rawDescription", args.rawDescription)
      )
      .collect();

    if (mappings.length === 0) return null;
    mappings.sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0));

    // Return the mapping, and touch the lastUsedAt behind the scenes if needed
    // (Queries can't mutate, so we'd have to fire an internal action/mutation if we wanted to bump usage async,
    // but for now, returning the cached match is the core need).
    return mappings[0];
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

    // Task 5: Priorytetyzacja learning - sort by usageCount (most used first)
    const results = await Promise.all(
      uniqueDescriptions.map(async (rawDescription) => {
        const mappings = await ctx.db
          .query("product_mappings")
          .withIndex("by_household_and_raw", (q) =>
            q.eq("householdId", args.householdId).eq("rawDescription", rawDescription)
          )
          .collect();

        if (mappings.length === 0) return null;
        
        // Sort by usageCount descending - most frequently used mapping first
        mappings.sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0));
        const bestMapping = mappings[0];
        
        return {
          rawDescription,
          mapping: bestMapping,
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
    await assertCategorySelectionForHousehold(ctx, args.householdId, args.categoryId, args.subcategoryId);

    if (!args.rawDescription || !args.correctedDescription) return;

    const existingMappings = await ctx.db
      .query("product_mappings")
      .withIndex("by_household_and_raw", (q) =>
        q.eq("householdId", args.householdId).eq("rawDescription", args.rawDescription)
      )
      .collect();
    existingMappings.sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0));
    const existing = existingMappings[0];

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

export const upsertMappingsBatch = mutation({
  args: {
    householdId: v.id("households"),
    items: v.array(v.object({
      rawDescription: v.string(),
      correctedDescription: v.string(),
      categoryId: v.id("categories"),
      subcategoryId: v.id("subcategories"),
    })),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await assertMember(ctx, args.householdId, userId);

    const deduped = new Map<string, typeof args.items[number]>();
    for (const item of args.items) {
      const rawDescription = item.rawDescription.trim();
      const correctedDescription = item.correctedDescription.trim();
      if (!rawDescription || !correctedDescription) continue;
      deduped.set(rawDescription, { ...item, rawDescription, correctedDescription });
    }

    for (const item of deduped.values()) {
      await assertCategorySelectionForHousehold(ctx, args.householdId, item.categoryId, item.subcategoryId);

      const existingMappings = await ctx.db
        .query("product_mappings")
        .withIndex("by_household_and_raw", (q) =>
          q.eq("householdId", args.householdId).eq("rawDescription", item.rawDescription)
        )
        .collect();
      existingMappings.sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0));
      const existing = existingMappings[0];

      if (existing) {
        await ctx.db.patch(existing._id, {
          correctedDescription: item.correctedDescription,
          categoryId: item.categoryId,
          subcategoryId: item.subcategoryId,
          usageCount: existing.usageCount + 1,
          lastUsedAt: Date.now(),
        });
      } else {
        await ctx.db.insert("product_mappings", {
          householdId: args.householdId,
          rawDescription: item.rawDescription,
          correctedDescription: item.correctedDescription,
          categoryId: item.categoryId,
          subcategoryId: item.subcategoryId,
          usageCount: 1,
          lastUsedAt: Date.now(),
        });
      }
    }

    return { upsertedCount: deduped.size };
  },
});
