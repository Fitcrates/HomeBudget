import { mutation } from "./_generated/server";
// Use the new icons from seed.ts
const DEFAULT_CATEGORIES: any[] = [
  {
    name: "Żywność i napoje", icon: "ShoppingCart",
    subcategories: [
      { name: "Supermarket", icon: "Store" }, { name: "Dyskont", icon: "ShoppingBag" }, { name: "Delikatesy", icon: "ShoppingBasket" }, { name: "Piekarnia", icon: "Croissant" }, { name: "Mięso i wędliny", icon: "Drumstick" }, { name: "Ryby i owoce morza", icon: "Fish" }, { name: "Owoce i warzywa", icon: "Apple" }, { name: "Nabiał i jaja", icon: "Milk" }, { name: "Mrożonki", icon: "Snowflake" }, { name: "Produkty sypkie", icon: "Wheat" }, { name: "Przyprawy i dodatki", icon: "Blend" }, { name: "Słodycze i przekąski", icon: "Candy" }, { name: "Napoje bezalkoholowe", icon: "CupSoda" }, { name: "Kawa i herbata", icon: "Coffee" }, { name: "Alkohol", icon: "Wine" }, { name: "Gotowe dania", icon: "Pizza" }, { name: "Produkty bio", icon: "Leaf" },
    ],
  },
  {
    name: "Chemia domowa i higiena", icon: "SprayCan",
    subcategories: [
      { name: "Środki czystości", icon: "Sponge" }, { name: "Pranie", icon: "WashingMachine" }, { name: "Zmywanie", icon: "Utensils" }, { name: "Papier i ręczniki", icon: "Scroll" }, { name: "Artykuły do WC", icon: "Bath" }, { name: "Odświeżacze", icon: "Sparkles" }, { name: "Higiena osobista", icon: "Hand" }, { name: "Pielęgnacja ciała", icon: "Droplet" }, { name: "Kosmetyki i makijaż", icon: "Brush" }, { name: "Perfumy i zapachy", icon: "Flower" }, { name: "Artykuły higieniczne dla dzieci", icon: "Baby" }, { name: "Artykuły higieniczne intymne", icon: "Heart" },
    ],
  },
  {
    name: "Restauracje i kawiarnie", icon: "UtensilsCrossed",
    subcategories: [
      { name: "Restauracja", icon: "Utensils" }, { name: "Fast food", icon: "Sandwich" }, { name: "Kawiarnia", icon: "Coffee" }, { name: "Pizza", icon: "Pizza" }, { name: "Sushi", icon: "Fish" }, { name: "Dostawa jedzenia", icon: "Bike" },
    ],
  },
  {
    name: "Transport", icon: "Car",
    subcategories: [
      { name: "Paliwo", icon: "Fuel" }, { name: "Parking", icon: "ParkingCircle" }, { name: "Komunikacja miejska", icon: "Bus" }, { name: "Taxi / Uber", icon: "CarTaxiFront" }, { name: "Pociąg", icon: "Train" }, { name: "Samolot", icon: "Plane" }, { name: "Serwis auta", icon: "Wrench" }, { name: "Ubezpieczenie auta", icon: "ShieldCheck" },
    ],
  },
  {
    name: "Dom i mieszkanie", icon: "Home",
    subcategories: [
      { name: "Czynsz", icon: "Building" }, { name: "Prąd", icon: "Lightbulb" }, { name: "Gaz", icon: "Flame" }, { name: "Woda", icon: "Droplets" }, { name: "Internet", icon: "Wifi" }, { name: "Telefon", icon: "Smartphone" }, { name: "Wyposażenie", icon: "Armchair" }, { name: "Akcesoria kuchenne", icon: "ChefHat" }, { name: "Dekoracje", icon: "Image" }, { name: "Ogród i balkon", icon: "Flower2" }, { name: "Remonty", icon: "Hammer" }, { name: "Sprzątanie", icon: "Brush" },
    ],
  },
  {
    name: "Zdrowie i uroda", icon: "HeartPulse",
    subcategories: [
      { name: "Apteka", icon: "Pill" }, { name: "Lekarz", icon: "Stethoscope" }, { name: "Dentysta", icon: "Smile" }, { name: "Siłownia / Sport", icon: "Dumbbell" }, { name: "Kosmetyki", icon: "Brush" }, { name: "Pielęgnacja twarzy", icon: "Sparkles" }, { name: "Perfumy", icon: "Droplet" }, { name: "Higiena osobista", icon: "Bath" }, { name: "Fryzjer", icon: "Scissors" }, { name: "Spa / Masaż", icon: "HeartHandshake" },
    ],
  },
  {
    name: "Rozrywka i hobby", icon: "Gamepad2",
    subcategories: [
      { name: "Kino / Teatr", icon: "Ticket" }, { name: "Streaming", icon: "MonitorPlay" }, { name: "Gry", icon: "Gamepad" }, { name: "Książki", icon: "BookOpen" }, { name: "Muzyka", icon: "Music" }, { name: "Sport / Bilety", icon: "TicketPercent" }, { name: "Hobby", icon: "Palette" }, { name: "Subskrypcje", icon: "BellRing" }, { name: "Wakacje", icon: "Palmtree" },
    ],
  },
  {
    name: "Ubrania i obuwie", icon: "Shirt",
    subcategories: [
      { name: "Odzież", icon: "Shirt" }, { name: "Obuwie", icon: "Footprints" }, { name: "Akcesoria", icon: "Watch" }, { name: "Bielizna", icon: "Briefcase" }, { name: "Odzież sportowa", icon: "Activity" }, { name: "Odzież dziecięca", icon: "Baby" },
    ],
  },
  {
    name: "Edukacja", icon: "GraduationCap",
    subcategories: [
      { name: "Kursy online", icon: "Laptop" }, { name: "Szkoła / Uczelnia", icon: "School" }, { name: "Korepetycje", icon: "PenTool" }, { name: "Podręczniki", icon: "Book" }, { name: "Języki obce", icon: "Globe" },
    ],
  },
  {
    name: "Finanse i ubezpieczenia", icon: "Landmark",
    subcategories: [
      { name: "Ubezpieczenie", icon: "Shield" }, { name: "Kredyt / Pożyczka", icon: "CreditCard" }, { name: "Oszczędności", icon: "PiggyBank" }, { name: "Inwestycje", icon: "TrendingUp" }, { name: "Opłaty bankowe", icon: "Wallet" }, { name: "Podatki", icon: "FileText" },
    ],
  },
  {
    name: "Dzieci", icon: "Baby",
    subcategories: [
      { name: "Żłobek / Przedszkole", icon: "Castle" }, { name: "Zabawki", icon: "Puzzle" }, { name: "Ubrania dziecięce", icon: "Shirt" }, { name: "Zajęcia dodatkowe", icon: "Palette" }, { name: "Artykuły dziecięce", icon: "Milk" }, { name: "Pieluchy i higiena", icon: "Heart" },
    ],
  },
  {
    name: "Zwierzęta", icon: "PawPrint",
    subcategories: [
      { name: "Karma", icon: "Bone" }, { name: "Weterynarz", icon: "Stethoscope" }, { name: "Akcesoria", icon: "ToyBrick" }, { name: "Grooming", icon: "Scissors" }, { name: "Żwirek i higiena", icon: "Recycle" },
    ],
  },
  {
    name: "Zakupy online i marketplace", icon: "Package",
    subcategories: [
      { name: "Marketplace", icon: "ShoppingCart" }, { name: "Elektronika", icon: "Smartphone" }, { name: "Dom i ogród", icon: "TreePine" }, { name: "Uroda i higiena", icon: "Sparkles" }, { name: "Książki i media", icon: "BookOpen" }, { name: "Koszty dostawy", icon: "Truck" },
    ],
  },
  {
    name: "Praca i biznes", icon: "Briefcase",
    subcategories: [
      { name: "Sprzęt biurowy", icon: "Printer" }, { name: "Materiały biurowe", icon: "Paperclip" }, { name: "Usługi księgowe", icon: "Calculator" }, { name: "Delegacje", icon: "Luggage" }, { name: "Narzędzia / SaaS", icon: "Cloud" },
    ],
  },
  {
    name: "Inne", icon: "LayoutList",
    subcategories: [
      { name: "Prezenty", icon: "Gift" }, { name: "Darowizny", icon: "HeartHandshake" }, { name: "Różne", icon: "Archive" },
    ],
  },
];

export const migrateEmojiToVectorIcons = mutation({
  args: {},
  handler: async (ctx) => {
    // 1. Map names to new icons
    const catMap = new Map<string, string>();
    const subMap = new Map<string, string>();
    
    for (const c of DEFAULT_CATEGORIES) {
      catMap.set(c.name, c.icon);
      for (const s of c.subcategories) {
         subMap.set(s.name, s.icon);
      }
    }

    // 2. Fetch and update categories
    const categories = await ctx.db.query("categories").collect();
    let catUpdated = 0;
    for (const cat of categories) {
      const newIcon = catMap.get(cat.name);
      if (newIcon && cat.icon !== newIcon) {
        await ctx.db.patch(cat._id, { icon: newIcon });
        catUpdated++;
      }
    }

    // 3. Fetch and update subcategories
    const subcategories = await ctx.db.query("subcategories").collect();
    let subUpdated = 0;
    for (const sub of subcategories) {
      const newIcon = subMap.get(sub.name);
      if (newIcon && sub.icon !== newIcon) {
        await ctx.db.patch(sub._id, { icon: newIcon });
        subUpdated++;
      }
    }

    return `Migrated ${catUpdated} categories and ${subUpdated} subcategories emojis to Lucide vectors.`;
  },
});
