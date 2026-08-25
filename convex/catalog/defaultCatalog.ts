/**
 * Jedno zrodlo prawdy dla domyslnego katalogu kategorii.
 *
 * Klucz jest identyfikatorem, nazwa jest prezentacja: logika (heurystyki OCR,
 * fallbacki, przyszle market packi) porownuje wylacznie `key`, a `labels`
 * sluzy tylko do wyswietlania. Dodanie jezyka = dodanie pola w `labels`.
 *
 * Klucz podkategorii jest zlozony z klucza kategorii i sufiksu, wiec
 * "Akcesoria" w ubraniach i w zwierzetach to dwa rozne byty
 * (clothing_accessories, pets_accessories) zamiast jednej nazwy
 * rozstrzyganej kontekstem.
 */

export type CatalogLanguage = "pl" | "en";

export const DEFAULT_LANGUAGE: CatalogLanguage = "pl";
export const DEFAULT_COUNTRY = "PL";

export interface CatalogLabels {
  pl: string;
  en: string;
}

export interface CatalogSubcategory {
  /** Sufiks klucza, laczony z kluczem kategorii. */
  suffix: string;
  icon: string;
  labels: CatalogLabels;
}

export interface CatalogCategory {
  key: string;
  icon: string;
  color: string;
  labels: CatalogLabels;
  subcategories: CatalogSubcategory[];
}

export const DEFAULT_CATALOG: CatalogCategory[] = [
  {
    key: "food",
    icon: "ShoppingCart",
    color: "#10B981",
    labels: { pl: "Żywność i napoje", en: "Food & drinks" },
    subcategories: [
      { suffix: "supermarket", icon: "Store", labels: { pl: "Supermarket", en: "Supermarket" } },
      { suffix: "discount_store", icon: "ShoppingBag", labels: { pl: "Dyskont", en: "Discount store" } },
      { suffix: "deli", icon: "ShoppingBasket", labels: { pl: "Delikatesy", en: "Delicatessen" } },
      { suffix: "bakery", icon: "Croissant", labels: { pl: "Piekarnia", en: "Bakery" } },
      { suffix: "meat", icon: "Drumstick", labels: { pl: "Mięso i wędliny", en: "Meat & cold cuts" } },
      { suffix: "fish", icon: "Fish", labels: { pl: "Ryby i owoce morza", en: "Fish & seafood" } },
      { suffix: "produce", icon: "Apple", labels: { pl: "Owoce i warzywa", en: "Fruit & vegetables" } },
      { suffix: "dairy", icon: "Milk", labels: { pl: "Nabiał i jaja", en: "Dairy & eggs" } },
      { suffix: "frozen", icon: "Snowflake", labels: { pl: "Mrożonki", en: "Frozen food" } },
      { suffix: "dry_goods", icon: "Wheat", labels: { pl: "Produkty sypkie", en: "Dry goods" } },
      { suffix: "spices", icon: "Blend", labels: { pl: "Przyprawy i dodatki", en: "Spices & condiments" } },
      { suffix: "sweets", icon: "Candy", labels: { pl: "Słodycze i przekąski", en: "Sweets & snacks" } },
      { suffix: "soft_drinks", icon: "CupSoda", labels: { pl: "Napoje bezalkoholowe", en: "Soft drinks" } },
      { suffix: "coffee_tea", icon: "Coffee", labels: { pl: "Kawa i herbata", en: "Coffee & tea" } },
      { suffix: "alcohol", icon: "Wine", labels: { pl: "Alkohol", en: "Alcohol" } },
      { suffix: "ready_meals", icon: "Pizza", labels: { pl: "Gotowe dania", en: "Ready meals" } },
      { suffix: "organic", icon: "Leaf", labels: { pl: "Produkty bio", en: "Organic food" } },
    ],
  },
  {
    key: "household",
    icon: "SprayCan",
    color: "#14B8A6",
    labels: { pl: "Chemia domowa i higiena", en: "Household & hygiene" },
    subcategories: [
      { suffix: "cleaning", icon: "Sponge", labels: { pl: "Środki czystości", en: "Cleaning products" } },
      { suffix: "laundry", icon: "WashingMachine", labels: { pl: "Pranie", en: "Laundry" } },
      { suffix: "dishwashing", icon: "Utensils", labels: { pl: "Zmywanie", en: "Dishwashing" } },
      { suffix: "paper", icon: "Scroll", labels: { pl: "Papier i ręczniki", en: "Paper & towels" } },
      { suffix: "wc", icon: "Bath", labels: { pl: "Artykuły do WC", en: "Bathroom supplies" } },
      { suffix: "air_fresheners", icon: "Sparkles", labels: { pl: "Odświeżacze", en: "Air fresheners" } },
      { suffix: "personal_hygiene", icon: "Hand", labels: { pl: "Higiena osobista", en: "Personal hygiene" } },
      { suffix: "body_care", icon: "Droplet", labels: { pl: "Pielęgnacja ciała", en: "Body care" } },
      { suffix: "makeup", icon: "Brush", labels: { pl: "Kosmetyki i makijaż", en: "Cosmetics & make-up" } },
      { suffix: "fragrances", icon: "Flower", labels: { pl: "Perfumy i zapachy", en: "Perfumes & fragrances" } },
      { suffix: "baby_hygiene", icon: "Baby", labels: { pl: "Artykuły higieniczne dla dzieci", en: "Baby hygiene" } },
      { suffix: "intimate_hygiene", icon: "Heart", labels: { pl: "Artykuły higieniczne intymne", en: "Intimate hygiene" } },
    ],
  },
  {
    key: "dining",
    icon: "UtensilsCrossed",
    color: "#F59E0B",
    labels: { pl: "Restauracje i kawiarnie", en: "Restaurants & cafés" },
    subcategories: [
      { suffix: "restaurant", icon: "Utensils", labels: { pl: "Restauracja", en: "Restaurant" } },
      { suffix: "fast_food", icon: "Sandwich", labels: { pl: "Fast food", en: "Fast food" } },
      { suffix: "cafe", icon: "Coffee", labels: { pl: "Kawiarnia", en: "Café" } },
      { suffix: "pizza", icon: "Pizza", labels: { pl: "Pizza", en: "Pizza" } },
      { suffix: "sushi", icon: "Fish", labels: { pl: "Sushi", en: "Sushi" } },
      { suffix: "delivery", icon: "Bike", labels: { pl: "Dostawa jedzenia", en: "Food delivery" } },
    ],
  },
  {
    key: "transport",
    icon: "Car",
    color: "#3B82F6",
    labels: { pl: "Transport", en: "Transport" },
    subcategories: [
      { suffix: "fuel", icon: "Fuel", labels: { pl: "Paliwo", en: "Fuel" } },
      { suffix: "parking", icon: "ParkingCircle", labels: { pl: "Parking", en: "Parking" } },
      { suffix: "public", icon: "Bus", labels: { pl: "Komunikacja miejska", en: "Public transport" } },
      { suffix: "taxi", icon: "CarTaxiFront", labels: { pl: "Taxi / Uber", en: "Taxi & ride-hailing" } },
      { suffix: "train", icon: "Train", labels: { pl: "Pociąg", en: "Train" } },
      { suffix: "flight", icon: "Plane", labels: { pl: "Samolot", en: "Flights" } },
      { suffix: "car_service", icon: "Wrench", labels: { pl: "Serwis auta", en: "Car service" } },
      { suffix: "car_insurance", icon: "ShieldCheck", labels: { pl: "Ubezpieczenie auta", en: "Car insurance" } },
    ],
  },
  {
    key: "home",
    icon: "Home",
    color: "#8B5CF6",
    labels: { pl: "Dom i mieszkanie", en: "Home & housing" },
    subcategories: [
      { suffix: "rent", icon: "Building", labels: { pl: "Czynsz", en: "Rent" } },
      { suffix: "electricity", icon: "Lightbulb", labels: { pl: "Prąd", en: "Electricity" } },
      { suffix: "gas", icon: "Flame", labels: { pl: "Gaz", en: "Gas" } },
      { suffix: "water", icon: "Droplets", labels: { pl: "Woda", en: "Water" } },
      { suffix: "internet", icon: "Wifi", labels: { pl: "Internet", en: "Internet" } },
      { suffix: "phone", icon: "Smartphone", labels: { pl: "Telefon", en: "Phone" } },
      { suffix: "furnishing", icon: "Armchair", labels: { pl: "Wyposażenie", en: "Furnishings" } },
      { suffix: "kitchenware", icon: "ChefHat", labels: { pl: "Akcesoria kuchenne", en: "Kitchenware" } },
      { suffix: "decor", icon: "Image", labels: { pl: "Dekoracje", en: "Decor" } },
      { suffix: "garden", icon: "Flower2", labels: { pl: "Ogród i balkon", en: "Garden & balcony" } },
      { suffix: "renovation", icon: "Hammer", labels: { pl: "Remonty", en: "Renovation" } },
      { suffix: "cleaning_service", icon: "Brush", labels: { pl: "Sprzątanie", en: "Cleaning" } },
    ],
  },
  {
    key: "health",
    icon: "HeartPulse",
    color: "#EF4444",
    labels: { pl: "Zdrowie i uroda", en: "Health & beauty" },
    subcategories: [
      { suffix: "pharmacy", icon: "Pill", labels: { pl: "Apteka", en: "Pharmacy" } },
      { suffix: "doctor", icon: "Stethoscope", labels: { pl: "Lekarz", en: "Doctor" } },
      { suffix: "dentist", icon: "Smile", labels: { pl: "Dentysta", en: "Dentist" } },
      { suffix: "gym", icon: "Dumbbell", labels: { pl: "Siłownia / Sport", en: "Gym & sport" } },
      { suffix: "cosmetics", icon: "Brush", labels: { pl: "Kosmetyki", en: "Cosmetics" } },
      { suffix: "face_care", icon: "Sparkles", labels: { pl: "Pielęgnacja twarzy", en: "Face care" } },
      { suffix: "perfume", icon: "Droplet", labels: { pl: "Perfumy", en: "Perfumes" } },
      { suffix: "personal_hygiene", icon: "Bath", labels: { pl: "Higiena osobista", en: "Personal hygiene" } },
      { suffix: "hairdresser", icon: "Scissors", labels: { pl: "Fryzjer", en: "Hairdresser" } },
      { suffix: "spa", icon: "HeartHandshake", labels: { pl: "Spa / Masaż", en: "Spa & massage" } },
    ],
  },
  {
    key: "leisure",
    icon: "Gamepad2",
    color: "#EC4899",
    labels: { pl: "Rozrywka i hobby", en: "Entertainment & hobbies" },
    subcategories: [
      { suffix: "cinema", icon: "Ticket", labels: { pl: "Kino / Teatr", en: "Cinema & theatre" } },
      { suffix: "streaming", icon: "MonitorPlay", labels: { pl: "Streaming", en: "Streaming" } },
      { suffix: "games", icon: "Gamepad", labels: { pl: "Gry", en: "Games" } },
      { suffix: "books", icon: "BookOpen", labels: { pl: "Książki", en: "Books" } },
      { suffix: "music", icon: "Music", labels: { pl: "Muzyka", en: "Music" } },
      { suffix: "sport_tickets", icon: "TicketPercent", labels: { pl: "Sport / Bilety", en: "Sport & tickets" } },
      { suffix: "hobby", icon: "Palette", labels: { pl: "Hobby", en: "Hobby" } },
      { suffix: "subscriptions", icon: "BellRing", labels: { pl: "Subskrypcje", en: "Subscriptions" } },
      { suffix: "holidays", icon: "Palmtree", labels: { pl: "Wakacje", en: "Holidays" } },
    ],
  },
  {
    key: "clothing",
    icon: "Shirt",
    color: "#06B6D4",
    labels: { pl: "Ubrania i obuwie", en: "Clothing & footwear" },
    subcategories: [
      { suffix: "apparel", icon: "Shirt", labels: { pl: "Odzież", en: "Clothing" } },
      { suffix: "footwear", icon: "Footprints", labels: { pl: "Obuwie", en: "Footwear" } },
      { suffix: "accessories", icon: "Watch", labels: { pl: "Akcesoria", en: "Accessories" } },
      { suffix: "underwear", icon: "Briefcase", labels: { pl: "Bielizna", en: "Underwear" } },
      { suffix: "sportswear", icon: "Activity", labels: { pl: "Odzież sportowa", en: "Sportswear" } },
      { suffix: "kids", icon: "Baby", labels: { pl: "Odzież dziecięca", en: "Kids' clothing" } },
    ],
  },
  {
    key: "education",
    icon: "GraduationCap",
    color: "#F97316",
    labels: { pl: "Edukacja", en: "Education" },
    subcategories: [
      { suffix: "online_courses", icon: "Laptop", labels: { pl: "Kursy online", en: "Online courses" } },
      { suffix: "school", icon: "School", labels: { pl: "Szkoła / Uczelnia", en: "School & university" } },
      { suffix: "tutoring", icon: "PenTool", labels: { pl: "Korepetycje", en: "Tutoring" } },
      { suffix: "textbooks", icon: "Book", labels: { pl: "Podręczniki", en: "Textbooks" } },
      { suffix: "languages", icon: "Globe", labels: { pl: "Języki obce", en: "Languages" } },
    ],
  },
  {
    key: "finance",
    icon: "Landmark",
    color: "#84CC16",
    labels: { pl: "Finanse i ubezpieczenia", en: "Finance & insurance" },
    subcategories: [
      { suffix: "insurance", icon: "Shield", labels: { pl: "Ubezpieczenie", en: "Insurance" } },
      { suffix: "loan", icon: "CreditCard", labels: { pl: "Kredyt / Pożyczka", en: "Loans & credit" } },
      { suffix: "savings", icon: "PiggyBank", labels: { pl: "Oszczędności", en: "Savings" } },
      { suffix: "investments", icon: "TrendingUp", labels: { pl: "Inwestycje", en: "Investments" } },
      { suffix: "bank_fees", icon: "Wallet", labels: { pl: "Opłaty bankowe", en: "Bank fees" } },
      { suffix: "taxes", icon: "FileText", labels: { pl: "Podatki", en: "Taxes" } },
    ],
  },
  {
    key: "kids",
    icon: "Baby",
    color: "#FBBF24",
    labels: { pl: "Dzieci", en: "Kids" },
    subcategories: [
      { suffix: "daycare", icon: "Castle", labels: { pl: "Żłobek / Przedszkole", en: "Daycare & preschool" } },
      { suffix: "toys", icon: "Puzzle", labels: { pl: "Zabawki", en: "Toys" } },
      { suffix: "clothing", icon: "Shirt", labels: { pl: "Ubrania dziecięce", en: "Kids' clothing" } },
      { suffix: "activities", icon: "Palette", labels: { pl: "Zajęcia dodatkowe", en: "After-school activities" } },
      { suffix: "supplies", icon: "Milk", labels: { pl: "Artykuły dziecięce", en: "Baby supplies" } },
      { suffix: "diapers", icon: "Heart", labels: { pl: "Pieluchy i higiena", en: "Diapers & hygiene" } },
    ],
  },
  {
    key: "pets",
    icon: "PawPrint",
    color: "#A78BFA",
    labels: { pl: "Zwierzęta", en: "Pets" },
    subcategories: [
      { suffix: "food", icon: "Bone", labels: { pl: "Karma", en: "Pet food" } },
      { suffix: "vet", icon: "Stethoscope", labels: { pl: "Weterynarz", en: "Vet" } },
      { suffix: "accessories", icon: "ToyBrick", labels: { pl: "Akcesoria", en: "Accessories" } },
      { suffix: "grooming", icon: "Scissors", labels: { pl: "Grooming", en: "Grooming" } },
      { suffix: "litter", icon: "Recycle", labels: { pl: "Żwirek i higiena", en: "Litter & hygiene" } },
    ],
  },
  {
    key: "online",
    icon: "Package",
    color: "#0EA5E9",
    labels: { pl: "Zakupy online i marketplace", en: "Online shopping" },
    subcategories: [
      { suffix: "marketplace", icon: "ShoppingCart", labels: { pl: "Marketplace", en: "Marketplace" } },
      { suffix: "electronics", icon: "Smartphone", labels: { pl: "Elektronika", en: "Electronics" } },
      { suffix: "home_garden", icon: "TreePine", labels: { pl: "Dom i ogród", en: "Home & garden" } },
      { suffix: "beauty", icon: "Sparkles", labels: { pl: "Uroda i higiena", en: "Beauty & hygiene" } },
      { suffix: "books_media", icon: "BookOpen", labels: { pl: "Książki i media", en: "Books & media" } },
      { suffix: "shipping", icon: "Truck", labels: { pl: "Koszty dostawy", en: "Shipping costs" } },
    ],
  },
  {
    key: "business",
    icon: "Briefcase",
    color: "#6366F1",
    labels: { pl: "Praca i biznes", en: "Work & business" },
    subcategories: [
      { suffix: "office_equipment", icon: "Printer", labels: { pl: "Sprzęt biurowy", en: "Office equipment" } },
      { suffix: "office_supplies", icon: "Paperclip", labels: { pl: "Materiały biurowe", en: "Office supplies" } },
      { suffix: "accounting", icon: "Calculator", labels: { pl: "Usługi księgowe", en: "Accounting services" } },
      { suffix: "travel", icon: "Luggage", labels: { pl: "Delegacje", en: "Business travel" } },
      { suffix: "saas", icon: "Cloud", labels: { pl: "Narzędzia / SaaS", en: "Tools & SaaS" } },
    ],
  },
  {
    key: "other",
    icon: "LayoutList",
    color: "#6B7280",
    labels: { pl: "Inne", en: "Other" },
    subcategories: [
      { suffix: "gifts", icon: "Gift", labels: { pl: "Prezenty", en: "Gifts" } },
      { suffix: "donations", icon: "HeartHandshake", labels: { pl: "Darowizny", en: "Donations" } },
      { suffix: "misc", icon: "Archive", labels: { pl: "Różne", en: "Miscellaneous" } },
    ],
  },
];

/** Klucz podkategorii: zawsze `${categoryKey}_${suffix}`. */
export function subcategoryKey(categoryKey: string, suffix: string): string {
  return `${categoryKey}_${suffix}`;
}

/**
 * Brak deklaracji = polski (zgodnie z zachowaniem sprzed wielorynkowosci, tak
 * wygladaja gospodarstwa sprzed migracji). Jezyk zadeklarowany, ale nieznany,
 * schodzi do angielskiego — polskie etykiety nie pomoga nikomu, kto o polski
 * nie prosil.
 */
export function resolveLanguage(language: string | null | undefined): CatalogLanguage {
  const requested = (language ?? "").trim().toLowerCase();
  if (!requested) return DEFAULT_LANGUAGE;
  if (requested === "pl" || requested === "en") return requested;
  return "en";
}

export function categoryLabel(category: CatalogCategory, language: CatalogLanguage): string {
  return category.labels[language] ?? category.labels[DEFAULT_LANGUAGE];
}

export function subcategoryLabel(subcategory: CatalogSubcategory, language: CatalogLanguage): string {
  return subcategory.labels[language] ?? subcategory.labels[DEFAULT_LANGUAGE];
}

/** Normalizacja do porownan nazw: bez znakow diakrytycznych, bez interpunkcji. */
export function normalizeLabel(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/ł/g, "l")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const categoryKeyByLabel = new Map<string, string>();
const subcategoryKeyByLabel = new Map<string, string>();

for (const category of DEFAULT_CATALOG) {
  for (const label of Object.values(category.labels)) {
    categoryKeyByLabel.set(normalizeLabel(label), category.key);
  }
  for (const subcategory of category.subcategories) {
    const fullKey = subcategoryKey(category.key, subcategory.suffix);
    for (const label of Object.values(subcategory.labels)) {
      // Etykiety podkategorii powtarzaja sie miedzy kategoriami ("Akcesoria"),
      // wiec indeks jest per kategoria.
      subcategoryKeyByLabel.set(`${category.key}|${normalizeLabel(label)}`, fullKey);
    }
  }
}

/** Klucz kategorii dla nazwy w dowolnym obslugiwanym jezyku (backfill migracji). */
export function categoryKeyForLabel(name: string): string | null {
  return categoryKeyByLabel.get(normalizeLabel(name)) ?? null;
}

/** Klucz podkategorii dla nazwy w obrebie znanej kategorii. */
export function subcategoryKeyForLabel(categoryKey: string, name: string): string | null {
  return subcategoryKeyByLabel.get(`${categoryKey}|${normalizeLabel(name)}`) ?? null;
}

export function findCatalogCategory(key: string): CatalogCategory | null {
  return DEFAULT_CATALOG.find((category) => category.key === key) ?? null;
}
