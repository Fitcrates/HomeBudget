"use node";

import { CategoryResolution } from "../types";
import { stripDiacritics } from "../utils";
import {
  findCatalogCategory,
  normalizeLabel,
  subcategoryKey,
} from "../../catalog/defaultCatalog";

export { stripDiacritics };
export type { CategoryResolution };

/**
 * Klucze katalogu, nie nazwy wyswietlane. Dzieki temu matchery w tym katalogu
 * (~600 linii) sa niezalezne od jezyka gospodarstwa — zmienia sie tylko to, co
 * `resolve()` znajdzie po kluczu.
 */
export const CATEGORY = {
  FOOD: "food",
  HOUSEHOLD: "household",
  DINING: "dining",
  TRANSPORT: "transport",
  HOME: "home",
  HEALTH: "health",
  FUN: "leisure",
  CLOTHES: "clothing",
  EDUCATION: "education",
  FINANCE: "finance",
  KIDS: "kids",
  PETS: "pets",
  ONLINE: "online",
  BUSINESS: "business",
  OTHER: "other",
} as const;

/**
 * Sufiksy kluczy podkategorii. Pelny klucz powstaje dopiero w `resolve()` jako
 * `${categoryKey}_${suffix}`, wiec ten sam sufiks moze wystepowac w kilku
 * kategoriach ("accessories" w ubraniach i u zwierzat) bez kolizji.
 */
export const SUB = {
  supermarket: "supermarket",
  dyskont: "discount_store",
  delikatesy: "deli",
  piekarnia: "bakery",
  mieso: "meat",
  ryby: "fish",
  owoce: "produce",
  nabial: "dairy",
  mrozonki: "frozen",
  sypkie: "dry_goods",
  przyprawy: "spices",
  slodycze: "sweets",
  napoje: "soft_drinks",
  kawaHerbata: "coffee_tea",
  alkohol: "alcohol",
  gotoweDania: "ready_meals",
  bio: "organic",
  srodkiCzystosci: "cleaning",
  pranie: "laundry",
  zmywanie: "dishwashing",
  papier: "paper",
  wc: "wc",
  odswiezacze: "air_fresheners",
  higienaOsobista: "personal_hygiene",
  pielegnacjaCiala: "body_care",
  kosmetykiMakijaz: "makeup",
  perfumyZapachy: "fragrances",
  higienaDzieci: "baby_hygiene",
  higienaIntymna: "intimate_hygiene",
  restauracja: "restaurant",
  fastFood: "fast_food",
  kawiarnia: "cafe",
  pizza: "pizza",
  sushi: "sushi",
  dostawaJedzenia: "delivery",
  paliwo: "fuel",
  parking: "parking",
  komunikacja: "public",
  taxi: "taxi",
  pociag: "train",
  samolot: "flight",
  serwisAuta: "car_service",
  autoUbezpieczenie: "car_insurance",
  czynsz: "rent",
  prad: "electricity",
  gaz: "gas",
  woda: "water",
  internet: "internet",
  telefon: "phone",
  wyposazenie: "furnishing",
  kuchnia: "kitchenware",
  dekoracje: "decor",
  ogrod: "garden",
  remonty: "renovation",
  sprzatanie: "cleaning_service",
  apteka: "pharmacy",
  lekarz: "doctor",
  dentysta: "dentist",
  silownia: "gym",
  kosmetyki: "cosmetics",
  twarz: "face_care",
  perfumy: "perfume",
  fryzjer: "hairdresser",
  spa: "spa",
  kino: "cinema",
  streaming: "streaming",
  gry: "games",
  ksiazki: "books",
  muzyka: "music",
  biletySport: "sport_tickets",
  hobby: "hobby",
  subskrypcje: "subscriptions",
  wakacje: "holidays",
  odziez: "apparel",
  obuwie: "footwear",
  akcesoria: "accessories",
  bielizna: "underwear",
  odziezSportowa: "sportswear",
  odziezDziecieca: "kids",
  kursyOnline: "online_courses",
  szkola: "school",
  korepetycje: "tutoring",
  podreczniki: "textbooks",
  jezyki: "languages",
  ubezpieczenie: "insurance",
  kredyt: "loan",
  oszczednosci: "savings",
  inwestycje: "investments",
  bank: "bank_fees",
  podatki: "taxes",
  zlobek: "daycare",
  zabawki: "toys",
  ubraniaDzieciece: "clothing",
  zajeciaDodatkowe: "activities",
  artykulyDzieciece: "supplies",
  pieluchy: "diapers",
  karma: "food",
  weterynarz: "vet",
  zwirek: "litter",
  grooming: "grooming",
  marketplace: "marketplace",
  elektronika: "electronics",
  domOgrod: "home_garden",
  urodaOnline: "beauty",
  ksiazkiMedia: "books_media",
  dostawa: "shipping",
  biuroSprzet: "office_equipment",
  biuroMaterialy: "office_supplies",
  ksiegowosc: "accounting",
  delegacje: "travel",
  saas: "saas",
  prezenty: "gifts",
  darowizny: "donations",
  rozne: "misc",
} as const;

export function has(text: string, pattern: RegExp) {
  return pattern.test(text);
}

const EMPTY_RESOLUTION: CategoryResolution = { categoryId: null, subcategoryId: null };

/**
 * Szuka po kluczu katalogu. Wiersze sprzed migracji kluczy jeszcze go nie maja,
 * wiec jest awaryjne dopasowanie po nazwie do etykiet katalogu — dziala dla
 * kazdego obslugiwanego jezyka, nie tylko polskiego.
 */
function findCategoryByKey(categoryKey: string, categoriesArray: any[]): any | null {
  const byKey = categoriesArray.find((entry: any) => entry?.key === categoryKey);
  if (byKey) return byKey;

  const catalogCategory = findCatalogCategory(categoryKey);
  if (!catalogCategory) return null;

  const labels = new Set(Object.values(catalogCategory.labels).map(normalizeLabel));
  return categoriesArray.find((entry: any) => labels.has(normalizeLabel(String(entry?.name ?? "")))) ?? null;
}

function findSubcategoryByKey(categoryKey: string, suffix: string, subcategories: any[]): any | null {
  const fullKey = subcategoryKey(categoryKey, suffix);
  const byKey = subcategories.find((entry: any) => entry?.key === fullKey);
  if (byKey) return byKey;

  const catalogCategory = findCatalogCategory(categoryKey);
  const catalogSubcategory = catalogCategory?.subcategories.find((entry) => entry.suffix === suffix);
  if (!catalogSubcategory) return null;

  const labels = new Set(Object.values(catalogSubcategory.labels).map(normalizeLabel));
  return subcategories.find((entry: any) => labels.has(normalizeLabel(String(entry?.name ?? "")))) ?? null;
}

export function resolve(categoryKey: string, subcategorySuffix: string, categoriesArray: any[]): CategoryResolution {
  const category = findCategoryByKey(categoryKey, categoriesArray);
  if (!category) return EMPTY_RESOLUTION;

  const subcategories = Array.isArray(category.subcategories) ? category.subcategories : [];
  const subcategory = findSubcategoryByKey(categoryKey, subcategorySuffix, subcategories);

  return {
    categoryId: category._id,
    subcategoryId: subcategory?._id ?? (subcategories.length > 0 ? subcategories[0]._id : null),
  };
}

/** Fallback pipeline'u: kategoria "Inne" / podkategoria "Rozne" po kluczu. */
export function resolveFallback(categoriesArray: any[]): CategoryResolution {
  const resolved = resolve(CATEGORY.OTHER, SUB.rozne, categoriesArray);
  if (resolved.categoryId) return resolved;

  const last = categoriesArray[categoriesArray.length - 1];
  const subcategories = Array.isArray(last?.subcategories) ? last.subcategories : [];
  return {
    categoryId: last?._id ?? null,
    subcategoryId: subcategories[0]?._id ?? null,
  };
}

/** Sufiksy podkategorii zbyt ogolnych, by uznac heurystyke za trafna. */
export const GENERIC_SUBCATEGORY_SUFFIXES = new Set<string>([
  SUB.supermarket,
  SUB.dyskont,
  SUB.delikatesy,
  SUB.higienaOsobista,
  SUB.wyposazenie,
  SUB.marketplace,
  SUB.rozne,
]);

export function buildCompactCategoryList(categories: any[]): string {
  return categories
    .map((cat: any) => {
      const subs = Array.isArray(cat.subcategories)
        ? cat.subcategories.map((sub: any) => sub.name).join(", ")
        : "";
      return `- ${cat.name}: ${subs}`;
    })
    .join("\n");
}

export function resolveCategoryNames(
  categoryName: string | null | undefined,
  subcategoryName: string | null | undefined,
  categoriesArray: any[]
): CategoryResolution {
  if (!categoryName) return { categoryId: null, subcategoryId: null };

  const categoryNormalized = stripDiacritics(categoryName);
  let category = categoriesArray.find(
    (entry: any) => entry.name.toLowerCase().trim() === categoryName.toLowerCase().trim()
  );
  if (!category) {
    category = categoriesArray.find((entry: any) => stripDiacritics(entry.name) === categoryNormalized);
  }
  if (!category) {
    category = categoriesArray.find(
      (entry: any) =>
        stripDiacritics(entry.name).includes(categoryNormalized) ||
        categoryNormalized.includes(stripDiacritics(entry.name))
    );
  }
  if (!category) return { categoryId: null, subcategoryId: null };

  const subcategories = Array.isArray(category.subcategories) ? category.subcategories : [];
  if (!subcategoryName) {
    return {
      categoryId: category._id,
      subcategoryId: subcategories.length > 0 ? subcategories[0]._id : null,
    };
  }

  const subcategoryNormalized = stripDiacritics(subcategoryName);
  let subcategory = subcategories.find(
    (entry: any) => entry.name.toLowerCase().trim() === subcategoryName.toLowerCase().trim()
  );
  if (!subcategory) {
    subcategory = subcategories.find((entry: any) => stripDiacritics(entry.name) === subcategoryNormalized);
  }
  if (!subcategory) {
    subcategory = subcategories.find(
      (entry: any) =>
        stripDiacritics(entry.name).includes(subcategoryNormalized) ||
        subcategoryNormalized.includes(stripDiacritics(entry.name))
    );
  }

  return {
    categoryId: category._id,
    subcategoryId: subcategory?._id ?? (subcategories.length > 0 ? subcategories[0]._id : null),
  };
}
