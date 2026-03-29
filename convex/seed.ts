import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

type DefaultSubcategory = {
  name: string;
  icon: string;
};

type DefaultCategory = {
  name: string;
  icon: string;
  color: string;
  subcategories: DefaultSubcategory[];
};

const DEFAULT_CATEGORIES: DefaultCategory[] = [
  {
    name: "Żywność i napoje",
    icon: "ShoppingCart",
    color: "#10B981",
    subcategories: [
      { name: "Supermarket", icon: "Store" },
      { name: "Dyskont", icon: "ShoppingBag" },
      { name: "Delikatesy", icon: "ShoppingBasket" },
      { name: "Piekarnia", icon: "Croissant" },
      { name: "Mięso i wędliny", icon: "Drumstick" },
      { name: "Ryby i owoce morza", icon: "Fish" },
      { name: "Owoce i warzywa", icon: "Apple" },
      { name: "Nabiał i jaja", icon: "Milk" },
      { name: "Mrożonki", icon: "Snowflake" },
      { name: "Produkty sypkie", icon: "Wheat" },
      { name: "Przyprawy i dodatki", icon: "Blend" },
      { name: "Słodycze i przekąski", icon: "Candy" },
      { name: "Napoje bezalkoholowe", icon: "CupSoda" },
      { name: "Kawa i herbata", icon: "Coffee" },
      { name: "Alkohol", icon: "Wine" },
      { name: "Gotowe dania", icon: "Pizza" },
      { name: "Produkty bio", icon: "Leaf" },
    ],
  },
  {
    name: "Chemia domowa i higiena",
    icon: "SprayCan",
    color: "#14B8A6",
    subcategories: [
      { name: "Środki czystości", icon: "Sponge" },
      { name: "Pranie", icon: "WashingMachine" },
      { name: "Zmywanie", icon: "Utensils" },
      { name: "Papier i ręczniki", icon: "Scroll" },
      { name: "Artykuły do WC", icon: "Bath" },
      { name: "Odświeżacze", icon: "Sparkles" },
      { name: "Higiena osobista", icon: "Hand" },
      { name: "Pielęgnacja ciała", icon: "Droplet" },
      { name: "Kosmetyki i makijaż", icon: "Brush" },
      { name: "Perfumy i zapachy", icon: "Flower" },
      { name: "Artykuły higieniczne dla dzieci", icon: "Baby" },
      { name: "Artykuły higieniczne intymne", icon: "Heart" },
    ],
  },
  {
    name: "Restauracje i kawiarnie",
    icon: "UtensilsCrossed",
    color: "#F59E0B",
    subcategories: [
      { name: "Restauracja", icon: "Utensils" },
      { name: "Fast food", icon: "Sandwich" },
      { name: "Kawiarnia", icon: "Coffee" },
      { name: "Pizza", icon: "Pizza" },
      { name: "Sushi", icon: "Fish" },
      { name: "Dostawa jedzenia", icon: "Bike" },
    ],
  },
  {
    name: "Transport",
    icon: "Car",
    color: "#3B82F6",
    subcategories: [
      { name: "Paliwo", icon: "Fuel" },
      { name: "Parking", icon: "ParkingCircle" },
      { name: "Komunikacja miejska", icon: "Bus" },
      { name: "Taxi / Uber", icon: "CarTaxiFront" },
      { name: "Pociąg", icon: "Train" },
      { name: "Samolot", icon: "Plane" },
      { name: "Serwis auta", icon: "Wrench" },
      { name: "Ubezpieczenie auta", icon: "ShieldCheck" },
    ],
  },
  {
    name: "Dom i mieszkanie",
    icon: "Home",
    color: "#8B5CF6",
    subcategories: [
      { name: "Czynsz", icon: "Building" },
      { name: "Prąd", icon: "Lightbulb" },
      { name: "Gaz", icon: "Flame" },
      { name: "Woda", icon: "Droplets" },
      { name: "Internet", icon: "Wifi" },
      { name: "Telefon", icon: "Smartphone" },
      { name: "Wyposażenie", icon: "Armchair" },
      { name: "Akcesoria kuchenne", icon: "ChefHat" },
      { name: "Dekoracje", icon: "Image" },
      { name: "Ogród i balkon", icon: "Flower2" },
      { name: "Remonty", icon: "Hammer" },
      { name: "Sprzątanie", icon: "Brush" },
    ],
  },
  {
    name: "Zdrowie i uroda",
    icon: "HeartPulse",
    color: "#EF4444",
    subcategories: [
      { name: "Apteka", icon: "Pill" },
      { name: "Lekarz", icon: "Stethoscope" },
      { name: "Dentysta", icon: "Smile" },
      { name: "Siłownia / Sport", icon: "Dumbbell" },
      { name: "Kosmetyki", icon: "Brush" },
      { name: "Pielęgnacja twarzy", icon: "Sparkles" },
      { name: "Perfumy", icon: "Droplet" },
      { name: "Higiena osobista", icon: "Bath" },
      { name: "Fryzjer", icon: "Scissors" },
      { name: "Spa / Masaż", icon: "HeartHandshake" },
    ],
  },
  {
    name: "Rozrywka i hobby",
    icon: "Gamepad2",
    color: "#EC4899",
    subcategories: [
      { name: "Kino / Teatr", icon: "Ticket" },
      { name: "Streaming", icon: "MonitorPlay" },
      { name: "Gry", icon: "Gamepad" },
      { name: "Książki", icon: "BookOpen" },
      { name: "Muzyka", icon: "Music" },
      { name: "Sport / Bilety", icon: "TicketPercent" },
      { name: "Hobby", icon: "Palette" },
      { name: "Subskrypcje", icon: "BellRing" },
      { name: "Wakacje", icon: "Palmtree" },
    ],
  },
  {
    name: "Ubrania i obuwie",
    icon: "Shirt",
    color: "#06B6D4",
    subcategories: [
      { name: "Odzież", icon: "Shirt" },
      { name: "Obuwie", icon: "Footprints" },
      { name: "Akcesoria", icon: "Watch" },
      { name: "Bielizna", icon: "Briefcase" },
      { name: "Odzież sportowa", icon: "Activity" },
      { name: "Odzież dziecięca", icon: "Baby" },
    ],
  },
  {
    name: "Edukacja",
    icon: "GraduationCap",
    color: "#F97316",
    subcategories: [
      { name: "Kursy online", icon: "Laptop" },
      { name: "Szkoła / Uczelnia", icon: "School" },
      { name: "Korepetycje", icon: "PenTool" },
      { name: "Podręczniki", icon: "Book" },
      { name: "Języki obce", icon: "Globe" },
    ],
  },
  {
    name: "Finanse i ubezpieczenia",
    icon: "Landmark",
    color: "#84CC16",
    subcategories: [
      { name: "Ubezpieczenie", icon: "Shield" },
      { name: "Kredyt / Pożyczka", icon: "CreditCard" },
      { name: "Oszczędności", icon: "PiggyBank" },
      { name: "Inwestycje", icon: "TrendingUp" },
      { name: "Opłaty bankowe", icon: "Wallet" },
      { name: "Podatki", icon: "FileText" },
    ],
  },
  {
    name: "Dzieci",
    icon: "Baby",
    color: "#FBBF24",
    subcategories: [
      { name: "Żłobek / Przedszkole", icon: "Castle" },
      { name: "Zabawki", icon: "Puzzle" },
      { name: "Ubrania dziecięce", icon: "Shirt" },
      { name: "Zajęcia dodatkowe", icon: "Palette" },
      { name: "Artykuły dziecięce", icon: "Milk" },
      { name: "Pieluchy i higiena", icon: "Heart" },
    ],
  },
  {
    name: "Zwierzęta",
    icon: "PawPrint",
    color: "#A78BFA",
    subcategories: [
      { name: "Karma", icon: "Bone" },
      { name: "Weterynarz", icon: "Stethoscope" },
      { name: "Akcesoria", icon: "ToyBrick" },
      { name: "Grooming", icon: "Scissors" },
      { name: "Żwirek i higiena", icon: "Recycle" },
    ],
  },
  {
    name: "Zakupy online i marketplace",
    icon: "Package",
    color: "#0EA5E9",
    subcategories: [
      { name: "Marketplace", icon: "ShoppingCart" },
      { name: "Elektronika", icon: "Smartphone" },
      { name: "Dom i ogród", icon: "TreePine" },
      { name: "Uroda i higiena", icon: "Sparkles" },
      { name: "Książki i media", icon: "BookOpen" },
      { name: "Koszty dostawy", icon: "Truck" },
    ],
  },
  {
    name: "Praca i biznes",
    icon: "Briefcase",
    color: "#6366F1",
    subcategories: [
      { name: "Sprzęt biurowy", icon: "Printer" },
      { name: "Materiały biurowe", icon: "Paperclip" },
      { name: "Usługi księgowe", icon: "Calculator" },
      { name: "Delegacje", icon: "Luggage" },
      { name: "Narzędzia / SaaS", icon: "Cloud" },
    ],
  },
  {
    name: "Inne",
    icon: "LayoutList",
    color: "#6B7280",
    subcategories: [
      { name: "Prezenty", icon: "Gift" },
      { name: "Darowizny", icon: "HeartHandshake" },
      { name: "Różne", icon: "Archive" },
    ],
  },
];

async function seedDefaultsForHousehold(
  ctx: any,
  householdId: any,
  options?: { onlyMissing?: boolean }
) {
  const existingCategories = await ctx.db
    .query("categories")
    .withIndex("by_household", (q: any) => q.eq("householdId", householdId))
    .collect();

  const categoriesByName = new Map<string, any>(
    existingCategories.map((category: any) => [category.name, category])
  );

  for (let i = 0; i < DEFAULT_CATEGORIES.length; i++) {
    const cat = DEFAULT_CATEGORIES[i];
    let targetCategory: any = categoriesByName.get(cat.name);

    if (!targetCategory) {
      const categoryId = await ctx.db.insert("categories", {
        householdId,
        name: cat.name,
        icon: cat.icon,
        color: cat.color,
        isSystem: false,
        sortOrder: i,
      });
      targetCategory = { _id: categoryId, name: cat.name };
      categoriesByName.set(cat.name, targetCategory);
    }

    const existingSubcategories = await ctx.db
      .query("subcategories")
      .withIndex("by_category", (q: any) => q.eq("categoryId", targetCategory._id))
      .collect();

    const subNames = new Set(existingSubcategories.map((sub: any) => sub.name));
    for (let j = 0; j < cat.subcategories.length; j++) {
      const sub = cat.subcategories[j];
      const shouldInsert = options?.onlyMissing ? !subNames.has(sub.name) : true;
      if (!shouldInsert) continue;

      await ctx.db.insert("subcategories", {
        categoryId: targetCategory._id,
        householdId,
        name: sub.name,
        icon: sub.icon,
        isSystem: false,
        sortOrder: j,
      });
      subNames.add(sub.name);
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
    await seedDefaultsForHousehold(ctx, args.householdId, { onlyMissing: true });
  },
});
