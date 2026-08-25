import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import {
  DEFAULT_CATALOG,
  categoryKeyForLabel,
  categoryLabel,
  resolveLanguage,
  subcategoryKey,
  subcategoryKeyForLabel,
  subcategoryLabel,
} from "./catalog/defaultCatalog";

/**
 * Sianie i synchronizacja domyslnego katalogu.
 *
 * Dopasowanie idzie po kluczu, a nie po nazwie wyswietlanej — inaczej zmiana
 * jezyka gospodarstwa podwoilaby katalog zamiast przetlumaczyc istniejacy.
 * Wiersze sprzed wprowadzenia kluczy dostaja klucz tutaj (backfill), bo ta
 * funkcja i tak jest wolana przy kazdym wejsciu do aplikacji.
 */
async function seedDefaultsForHousehold(ctx: any, householdId: any) {
  const household = await ctx.db.get(householdId);
  const language = resolveLanguage(household?.language);

  const existingCategories = await ctx.db
    .query("categories")
    .withIndex("by_household", (q: any) => q.eq("householdId", householdId))
    .collect();

  const categoriesByKey = new Map<string, any>();
  for (const category of existingCategories) {
    // Backfill: wiersz sprzed migracji nie ma klucza, ale jego nazwa pochodzi
    // z katalogu w jednym z obslugiwanych jezykow.
    const key = category.key || categoryKeyForLabel(category.name);
    if (!key) continue;
    if (!category.key) {
      await ctx.db.patch(category._id, { key });
    }
    if (!categoriesByKey.has(key)) {
      categoriesByKey.set(key, { ...category, key });
    }
  }

  for (let i = 0; i < DEFAULT_CATALOG.length; i++) {
    const catalogCategory = DEFAULT_CATALOG[i];
    const name = categoryLabel(catalogCategory, language);
    let targetCategory: any = categoriesByKey.get(catalogCategory.key);

    if (!targetCategory) {
      const categoryId = await ctx.db.insert("categories", {
        householdId,
        key: catalogCategory.key,
        name,
        icon: catalogCategory.icon,
        color: catalogCategory.color,
        isSystem: false,
        sortOrder: i,
      });
      targetCategory = { _id: categoryId, key: catalogCategory.key, name };
      categoriesByKey.set(catalogCategory.key, targetCategory);
    } else if (targetCategory.name !== name) {
      // Zmiana jezyka gospodarstwa: przetlumacz w miejscu, nie duplikuj.
      await ctx.db.patch(targetCategory._id, { name });
    }

    const existingSubcategories = await ctx.db
      .query("subcategories")
      .withIndex("by_category", (q: any) => q.eq("categoryId", targetCategory._id))
      .collect();

    const subcategoriesByKey = new Map<string, any>();
    for (const subcategory of existingSubcategories) {
      const key = subcategory.key || subcategoryKeyForLabel(catalogCategory.key, subcategory.name);
      if (!key) continue;
      if (!subcategory.key) {
        await ctx.db.patch(subcategory._id, { key });
      }
      if (!subcategoriesByKey.has(key)) {
        subcategoriesByKey.set(key, { ...subcategory, key });
      }
    }

    for (let j = 0; j < catalogCategory.subcategories.length; j++) {
      const catalogSubcategory = catalogCategory.subcategories[j];
      const key = subcategoryKey(catalogCategory.key, catalogSubcategory.suffix);
      const subName = subcategoryLabel(catalogSubcategory, language);
      const existing = subcategoriesByKey.get(key);

      if (existing) {
        if (existing.name !== subName) {
          await ctx.db.patch(existing._id, { name: subName });
        }
        continue;
      }

      const subcategoryId = await ctx.db.insert("subcategories", {
        categoryId: targetCategory._id,
        householdId,
        key,
        name: subName,
        icon: catalogSubcategory.icon,
        isSystem: false,
        sortOrder: j,
      });
      subcategoriesByKey.set(key, { _id: subcategoryId, key, name: subName });
    }
  }
}

export const seedDefaultCategories = internalMutation({
  args: { householdId: v.id("households") },
  handler: async (ctx, args) => {
    await seedDefaultsForHousehold(ctx, args.householdId);
  },
});

export const syncDefaultCategoriesForHousehold = internalMutation({
  args: { householdId: v.id("households") },
  handler: async (ctx, args) => {
    await seedDefaultsForHousehold(ctx, args.householdId);
  },
});
