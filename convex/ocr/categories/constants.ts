"use node";

import { CategoryResolution } from "../types";
import { stripDiacritics } from "../utils";

export { stripDiacritics };
export type { CategoryResolution };

export const CATEGORY = {
  FOOD: "Zywnosc i napoje",
  HOUSEHOLD: "Chemia domowa i higiena",
  DINING: "Restauracje i kawiarnie",
  TRANSPORT: "Transport",
  HOME: "Dom i mieszkanie",
  HEALTH: "Zdrowie i uroda",
  FUN: "Rozrywka i hobby",
  CLOTHES: "Ubrania i obuwie",
  EDUCATION: "Edukacja",
  FINANCE: "Finanse i ubezpieczenia",
  KIDS: "Dzieci",
  PETS: "Zwierzeta",
  ONLINE: "Zakupy online i marketplace",
  BUSINESS: "Praca i biznes",
  OTHER: "Inne",
} as const;

export const SUB = {
  supermarket: "Supermarket",
  dyskont: "Dyskont",
  delikatesy: "Delikatesy",
  piekarnia: "Piekarnia",
  mieso: "Mieso i wedliny",
  ryby: "Ryby i owoce morza",
  owoce: "Owoce i warzywa",
  nabial: "Nabial i jaja",
  mrozonki: "Mrozonki",
  sypkie: "Produkty sypkie",
  przyprawy: "Przyprawy i dodatki",
  slodycze: "Slodycze i przekaski",
  napoje: "Napoje bezalkoholowe",
  kawaHerbata: "Kawa i herbata",
  alkohol: "Alkohol",
  gotoweDania: "Gotowe dania",
  bio: "Produkty bio",
  srodkiCzystosci: "Srodki czystosci",
  pranie: "Pranie",
  zmywanie: "Zmywanie",
  papier: "Papier i reczniki",
  wc: "Artykuly do WC",
  odswiezacze: "Odswiezacze",
  higienaOsobista: "Higiena osobista",
  pielegnacjaCiala: "Pielegnacja ciala",
  kosmetykiMakijaz: "Kosmetyki i makijaz",
  perfumyZapachy: "Perfumy i zapachy",
  higienaDzieci: "Artykuly higieniczne dla dzieci",
  higienaIntymna: "Artykuly higieniczne intymne",
  restauracja: "Restauracja",
  fastFood: "Fast food",
  kawiarnia: "Kawiarnia",
  pizza: "Pizza",
  sushi: "Sushi",
  dostawaJedzenia: "Dostawa jedzenia",
  paliwo: "Paliwo",
  parking: "Parking",
  komunikacja: "Komunikacja miejska",
  taxi: "Taxi / Uber",
  pociag: "Pociag",
  samolot: "Samolot",
  serwisAuta: "Serwis auta",
  autoUbezpieczenie: "Ubezpieczenie auta",
  czynsz: "Czynsz",
  prad: "Prad",
  gaz: "Gaz",
  woda: "Woda",
  internet: "Internet",
  telefon: "Telefon",
  wyposazenie: "Wyposazenie",
  kuchnia: "Akcesoria kuchenne",
  dekoracje: "Dekoracje",
  ogrod: "Ogrod i balkon",
  remonty: "Remonty",
  sprzatanie: "Sprzatanie",
  apteka: "Apteka",
  lekarz: "Lekarz",
  dentysta: "Dentysta",
  silownia: "Silownia / Sport",
  kosmetyki: "Kosmetyki",
  twarz: "Pielegnacja twarzy",
  perfumy: "Perfumy",
  fryzjer: "Fryzjer",
  spa: "Spa / Masaz",
  kino: "Kino / Teatr",
  streaming: "Streaming",
  gry: "Gry",
  ksiazki: "Ksiazki",
  muzyka: "Muzyka",
  biletySport: "Sport / Bilety",
  hobby: "Hobby",
  subskrypcje: "Subskrypcje",
  wakacje: "Wakacje",
  odziez: "Odziez",
  obuwie: "Obuwie",
  akcesoria: "Akcesoria",
  bielizna: "Bielizna",
  odziezSportowa: "Odziez sportowa",
  odziezDziecieca: "Odziez dziecieca",
  kursyOnline: "Kursy online",
  szkola: "Szkola / Uczelnia",
  korepetycje: "Korepetycje",
  podreczniki: "Podreczniki",
  jezyki: "Jezyki obce",
  ubezpieczenie: "Ubezpieczenie",
  kredyt: "Kredyt / Pozyczka",
  oszczednosci: "Oszczednosci",
  inwestycje: "Inwestycje",
  bank: "Oplaty bankowe",
  podatki: "Podatki",
  zlobek: "Zlobek / Przedszkole",
  zabawki: "Zabawki",
  ubraniaDzieciece: "Ubrania dzieciece",
  zajeciaDodatkowe: "Zajecia dodatkowe",
  artykulyDzieciece: "Artykuly dzieciece",
  pieluchy: "Pieluchy i higiena",
  karma: "Karma",
  weterynarz: "Weterynarz",
  zwirek: "Zwirek i higiena",
  grooming: "Grooming",
  marketplace: "Marketplace",
  elektronika: "Elektronika",
  domOgrod: "Dom i ogrod",
  urodaOnline: "Uroda i higiena",
  ksiazkiMedia: "Ksiazki i media",
  dostawa: "Koszty dostawy",
  biuroSprzet: "Sprzet biurowy",
  biuroMaterialy: "Materialy biurowe",
  ksiegowosc: "Uslugi ksiegowe",
  delegacje: "Delegacje",
  saas: "Narzedzia / SaaS",
  prezenty: "Prezenty",
  darowizny: "Darowizny",
  rozne: "Rozne",
} as const;

export function has(text: string, pattern: RegExp) {
  return pattern.test(text);
}

export function resolve(categoryName: string, subcategoryName: string, categoriesArray: any[]): CategoryResolution {
  return resolveCategoryNames(categoryName, subcategoryName, categoriesArray);
}

function asString(value: unknown): string {
  if (typeof value === "string") return value;
  if (value == null) return "";
  return String(value);
}

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
