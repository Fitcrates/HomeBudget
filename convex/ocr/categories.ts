"use node";

import { CategoryResolution } from "./types";
import { stripDiacritics } from "./utils";

// Simple in-memory cache for heuristic category resolution
// Key: description + receiptContext, Value: cached resolution
const heuristicCache = new Map<string, CategoryResolution | null>();
const HEURISTIC_CACHE_MAX_SIZE = 200;

const CATEGORY = {
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

const SUB = {
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

function has(text: string, pattern: RegExp) {
  return pattern.test(text);
}

function resolve(categoryName: string, subcategoryName: string, categoriesArray: any[]): CategoryResolution {
  return resolveCategoryNames(categoryName, subcategoryName, categoriesArray);
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

function isCloudOrBusinessSaaSIssuer(text: string): boolean {
  return /\b(railway|vercel|render|fly\.io|digitalocean|linode|supabase|firebase|cloudflare|netlify|aws|amazon web services|gcp|google cloud|azure|mongodb atlas|planetscale|neon|upstash|replicate|openai|anthropic|resend|posthog|sentry|datadog|new relic|clerk|auth0|github|gitlab|atlassian|notion|slack|zoom|figma|canva|miro)\b/i.test(text);
}

function isBusinessSaaSLine(text: string, combinedContext: string): boolean {
  const infra = /\b(vcpu|cpu|memory|ram|disk|storage|bandwidth|egress|ingress|container|instance|compute|runtime|build minutes?|deployment|hosting|backend|server|database|postgres|redis|cdn|domain|ssl|smtp|workspace|seat|seats|monitoring|observability|log ingestion|network transfer|api usage|invoice|billing|subscription)\b/i;
  const plan = /\b(pro|team|starter|hobby|developer|enterprise)\s+plan\b/i;
  return infra.test(text) || (plan.test(text) && isCloudOrBusinessSaaSIssuer(combinedContext));
}

export function resolveHeuristicCategory(
  description: string,
  categoriesArray: any[],
  receiptContextText?: string
): CategoryResolution | null {
  // Check cache first
  const cacheKey = `${description}|${receiptContextText || ""}`;
  const cached = heuristicCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  const text = stripDiacritics(description);
  const receiptContext = stripDiacritics(receiptContextText || "");
  const combinedContext = `${receiptContext} ${text}`.trim();

  const isGroceryIssuer = has(receiptContext, /(biedronka|lidl|kaufland|auchan|carrefour|stokrot|netto|dino|zabka|spar|aldi|lewiatan|intermarche|supermarket|dyskont|delikates|frisco|e\.?leclerc)/i);
  const isBakeryIssuer = has(receiptContext, /(piekarni|piekarnia|cukiernia|putka|lubaszka|delekta|grycan|vinci|bakery)/i);
  const isCafeIssuer = has(receiptContext, /(kawiar|cafe\b|coffee\b|starbucks|costa|green caffe|nero|etno|so coffee|coffeedesk|cukierni|pijalni|palarni)/i);
  const isRestaurantIssuer = has(receiptContext, /(restaur|bistro|bar\b|oberza|karczm|trattor|ramen|kebab|burger|mcdonald|kfc|subway|pizzer|pizza|sushi|thai|noodle|food truck)/i);
  const isFastFoodIssuer = has(receiptContext, /(mcdonald|kfc|subway|burger king|burger|kebab|drive|fast food)/i);
  const isPizzaIssuer = has(receiptContext, /(pizzer|pizza|telepizza|domino)/i);
  const isSushiIssuer = has(receiptContext, /(sushi|maki|nigiri|uramaki)/i);
  const isFoodDeliveryIssuer = has(receiptContext, /(wolt|glovo|ubereats|pyszne|bolt food)/i);
  const isDrugstoreIssuer = has(receiptContext, /(rossmann|hebe|super.?pharm|douglas|sephora)/i);
  const isPharmacyIssuer = has(receiptContext, /(apteka|doz|ziko|gemini|cefarm|dr\.?\s?max)/i);
  const isPetIssuer = has(receiptContext, /(zoo|pet|kakadu|maxi zoo|weteryn)/i);
  const isHomeIssuer = has(receiptContext, /(castorama|leroy|obi|ikea|jysk|agata|mebl|ogrodnicz|bricomarche|pepco|action|homla|home&you)/i);
  const isClothingIssuer = has(receiptContext, /(hm\b|h&m|reserved|cropp|house\b|sinsay|zara|mohito|ccc|deichmann|halfprice|tk maxx|answear|zalando|eobuwie|modivo)/i);
  // Task 4: Wykrywanie używanej odzieży
  const isUsedClothing = has(receiptContext, /\b(uzyw|used|second.?hand|outlet|stock|deca)\b/i);
  const isBookIssuer = has(receiptContext, /(empik|matras|swiat ksiazki|bookstore|ksiegarnia)/i);
  const isToyIssuer = has(receiptContext, /(smyk|toys|zabawki|lego store)/i);
  const isElectronicsIssuer = has(receiptContext, /(media expert|media markt|rtv euro agd|x-kom|komputronik|apple|samsung|morele|neonet)/i);
  const isMarketplaceIssuer = has(receiptContext, /(allegro|amazon|ebay|olx|etsy|temu|aliexpress)/i);
  const isFuelIssuer = has(receiptContext, /(orlen|bp\b|shell|circle k|amic|moya|lotos|stacja paliw)/i);
  const isParkingIssuer = has(receiptContext, /(parking|skycash|citypark|parkomat|apcoa|parkmobile)/i);
  const isTaxiIssuer = has(receiptContext, /(uber|bolt|freenow|taxi)/i);
  const isRailIssuer = has(receiptContext, /(pkp|intercity|koleje|polregio|trainline)/i);
  const isFlightIssuer = has(receiptContext, /(ryanair|wizz|lot polish|lufthansa|booking flight|airlines|air france|easyjet)/i);
  const isMedicalIssuer = has(receiptContext, /(medicover|luxmed|enel|diagnostyka|lab|przychodnia|szpital|stomatolog|dent|ortodon|fizjo)/i);
  const isGymIssuer = has(receiptContext, /(gym|fitness|calypso|medicover sport|multisport|silownia|crossfit|basen)/i);
  const isCinemaIssuer = has(receiptContext, /(multikino|cinema city|helios|teatr|opera|filharmonia)/i);
  const isStreamingIssuer = has(receiptContext, /(netflix|spotify|youtube premium|hbo|max\b|disney|prime video|tidal|storytel|legimi|bookbeat)/i);
  const isTravelIssuer = has(receiptContext, /(booking\.com|airbnb|expedia|trivago|itaka|rainbow|travelplanet|hotel|resort|apartamenty|wakacje)/i);
  const isSchoolIssuer = has(receiptContext, /(szkola|uczelnia|uniwersytet|udemy|coursera|edx|language school|novakid|preply)/i);
  const isTelcoIssuer = has(receiptContext, /(orange|play\b|plus\b|tmobile|t-mobile|vectra|inea|upc|netia)/i);
  const isUtilityIssuer = has(receiptContext, /(tauron|enea|energa|pge|pgnig|veolia|mpwik|wodociagi|czynsz|spoldzielnia|wspolnota)/i);
  const isBankOrInsuranceIssuer = has(receiptContext, /(pzu|allianz|warta|generali|link4|ergo hestia|bank|mbank|ing\b|santander|pekao|millennium|revolut|visa|mastercard|ubezpieczenie)/i);
  const isBusinessIssuer = isCloudOrBusinessSaaSIssuer(receiptContext) || has(receiptContext, /(biuro|ksiegow|faktura|delegacja|hotel firmowy|drukarnia|papierniczy)/i);

  if (isBusinessSaaSLine(text, combinedContext)) {
    return resolve(CATEGORY.BUSINESS, SUB.saas, categoriesArray);
  }

  if (isFoodDeliveryIssuer) {
    return resolve(CATEGORY.DINING, SUB.dostawaJedzenia, categoriesArray);
  }

  if (isFuelIssuer || has(text, /\b(pb|pb95|pb98|on\b|diesel|adblue|paliwo|benzyna|olej napedowy|lpg)\b/i)) {
    return resolve(CATEGORY.TRANSPORT, SUB.paliwo, categoriesArray);
  }
  if (isParkingIssuer || has(text, /\b(parking|postoj|strefa platnego parkowania|parkomat)\b/i)) {
    return resolve(CATEGORY.TRANSPORT, SUB.parking, categoriesArray);
  }
  if (isTaxiIssuer || has(text, /\b(uber|bolt|taxi|przejazd)\b/i)) {
    return resolve(CATEGORY.TRANSPORT, SUB.taxi, categoriesArray);
  }
  if (isRailIssuer || has(text, /\b(pkp|intercity|bilet kolejowy|peron|wagon|train)\b/i)) {
    return resolve(CATEGORY.TRANSPORT, SUB.pociag, categoriesArray);
  }
  if (isFlightIssuer || has(text, /\b(lotnisko|bilet lotniczy|boarding|flight|airfare)\b/i)) {
    return resolve(CATEGORY.TRANSPORT, SUB.samolot, categoriesArray);
  }
  if (has(combinedContext, /\b(zkm|mpk|jakdojade|komunikacja miejska|bilet miejski|tramwaj|autobus|metro)\b/i)) {
    return resolve(CATEGORY.TRANSPORT, SUB.komunikacja, categoriesArray);
  }
  if (has(combinedContext, /\b(opony|warsztat|mechanik|wulkanizacja|przeglad|naprawa auta|serwis auta|myjnia|olej silnikowy|filtr kabinowy)\b/i)) {
    return resolve(CATEGORY.TRANSPORT, SUB.serwisAuta, categoriesArray);
  }
  if (has(combinedContext, /\b(oc\b|ac\b|autocasco|ubezpieczenie auta)\b/i)) {
    return resolve(CATEGORY.TRANSPORT, SUB.autoUbezpieczenie, categoriesArray);
  }

  if (has(combinedContext, /\b(czynsz|najem|oplata administracyjna|spoldzielnia|wspolnota mieszkaniowa)\b/i)) {
    return resolve(CATEGORY.HOME, SUB.czynsz, categoriesArray);
  }
  if (isUtilityIssuer && has(combinedContext, /\b(prad|energia|kwh|dystrybucja)\b/i)) {
    return resolve(CATEGORY.HOME, SUB.prad, categoriesArray);
  }
  if (isUtilityIssuer && has(combinedContext, /\b(gaz|pgnig)\b/i)) {
    return resolve(CATEGORY.HOME, SUB.gaz, categoriesArray);
  }
  if (isUtilityIssuer && has(combinedContext, /\b(woda|scieki|wodociagi)\b/i)) {
    return resolve(CATEGORY.HOME, SUB.woda, categoriesArray);
  }
  if (isTelcoIssuer && has(combinedContext, /\b(internet|swiatlowod|fiber|router|wifi)\b/i)) {
    return resolve(CATEGORY.HOME, SUB.internet, categoriesArray);
  }
  if (isTelcoIssuer || has(combinedContext, /\b(abonament|telefon|komorka|rozmowy|sms|starter|doladowanie)\b/i)) {
    return resolve(CATEGORY.HOME, SUB.telefon, categoriesArray);
  }

  if (isTravelIssuer || has(combinedContext, /\b(hotel|nocleg|apartament|booking|wakacje|resort|camping|kemping|city break)\b/i)) {
    return resolve(CATEGORY.FUN, SUB.wakacje, categoriesArray);
  }
  if (isStreamingIssuer || has(text, /\b(subskrypcja|abonament premium|vod|streaming)\b/i)) {
    if (has(combinedContext, /\b(spotify|tidal|apple music)\b/i)) {
      return resolve(CATEGORY.FUN, SUB.muzyka, categoriesArray);
    }
    if (has(combinedContext, /\b(legimi|storytel|bookbeat)\b/i)) {
      return resolve(CATEGORY.FUN, SUB.subskrypcje, categoriesArray);
    }
    return resolve(CATEGORY.FUN, SUB.streaming, categoriesArray);
  }
  if (isCinemaIssuer || has(combinedContext, /\b(kino|teatr|musical|opera|koncert|standup)\b/i)) {
    return resolve(CATEGORY.FUN, SUB.kino, categoriesArray);
  }
  if (has(combinedContext, /\b(playstation|xbox|steam|epic games|nintendo|gra\b|game pass)\b/i)) {
    return resolve(CATEGORY.FUN, SUB.gry, categoriesArray);
  }
  if (isBookIssuer || has(combinedContext, /\b(ksiazka|audiobook|ebook|komiks|powiesc)\b/i)) {
    return resolve(CATEGORY.FUN, SUB.ksiazki, categoriesArray);
  }
  if (has(combinedContext, /\b(bilet|mecz|stadion|sport event|wejscie)\b/i)) {
    return resolve(CATEGORY.FUN, SUB.biletySport, categoriesArray);
  }
  if (has(combinedContext, /\b(farby plakatowe|modelarskie|pasmanteria|sztaluga|wloczka|instrument|ukulele|gitara|hobby)\b/i)) {
    return resolve(CATEGORY.FUN, SUB.hobby, categoriesArray);
  }

  if (isSchoolIssuer || has(combinedContext, /\b(korepetycje|lekcja|kurs online|kurs|certyfikat|szkolenie|studia|uczelnia)\b/i)) {
    if (has(combinedContext, /\b(udemy|coursera|online|kurs online)\b/i)) {
      return resolve(CATEGORY.EDUCATION, SUB.kursyOnline, categoriesArray);
    }
    if (has(combinedContext, /\b(angielski|hiszpanski|niemiecki|francuski|jezyk)\b/i)) {
      return resolve(CATEGORY.EDUCATION, SUB.jezyki, categoriesArray);
    }
    if (has(combinedContext, /\b(korepetycje|tutor)\b/i)) {
      return resolve(CATEGORY.EDUCATION, SUB.korepetycje, categoriesArray);
    }
    return resolve(CATEGORY.EDUCATION, SUB.szkola, categoriesArray);
  }
  if (has(combinedContext, /\b(podrecznik|zeszyt cwiczen|atlas szkolny|lektura)\b/i)) {
    return resolve(CATEGORY.EDUCATION, SUB.podreczniki, categoriesArray);
  }

  if (has(combinedContext, /\b(zlobek|przedszkole|opiekun dzienny)\b/i)) {
    return resolve(CATEGORY.KIDS, SUB.zlobek, categoriesArray);
  }
  if (isToyIssuer || has(combinedContext, /\b(zabawka|lalka|klocki|lego|pluszak|gra planszowa dla dzieci)\b/i)) {
    return resolve(CATEGORY.KIDS, SUB.zabawki, categoriesArray);
  }
  if (has(combinedContext, /\b(pieluch|chusteczki dla dzieci|mleko modyfikowane|smoczek|butelka dla niemowlat|kaszka|body dzieciece|wozek|fotelik)\b/i)) {
    if (has(combinedContext, /\b(pieluch|chusteczki|krem na odparzenia)\b/i)) {
      return resolve(CATEGORY.KIDS, SUB.pieluchy, categoriesArray);
    }
    return resolve(CATEGORY.KIDS, SUB.artykulyDzieciece, categoriesArray);
  }
  if (has(combinedContext, /\b(taniec|basen dla dzieci|robotyka|angielski dla dzieci|zajecia dodatkowe)\b/i)) {
    return resolve(CATEGORY.KIDS, SUB.zajeciaDodatkowe, categoriesArray);
  }

  if (isPetIssuer || has(text, /\b(karma|zwirek|weteryn|drapak|smycz|obroza|kuweta|miska|przysmak dla psa|przysmak dla kota)\b/i)) {
    if (has(combinedContext, /\b(weteryn|vet|szczepienie|badanie psa|badanie kota)\b/i)) {
      return resolve(CATEGORY.PETS, SUB.weterynarz, categoriesArray);
    }
    if (has(combinedContext, /\b(zwirek|kuweta|podklad higieniczny)\b/i)) {
      return resolve(CATEGORY.PETS, SUB.zwirek, categoriesArray);
    }
    if (has(combinedContext, /\b(karma|saszetka|puszka|sucha karma)\b/i)) {
      return resolve(CATEGORY.PETS, SUB.karma, categoriesArray);
    }
    return resolve(CATEGORY.PETS, SUB.akcesoria, categoriesArray);
  }

  if (isPharmacyIssuer || has(text, /\b(lek|tablet|tabl|syrop|kaps|suplement|wit|vit|masc|krem lecz|plaster|termometr)\b/i)) {
    return resolve(CATEGORY.HEALTH, SUB.apteka, categoriesArray);
  }
  if (isMedicalIssuer || has(combinedContext, /\b(konsultacja|badanie|przychodnia|laboratorium|usg|rehabilitacja|fizjoterapia)\b/i)) {
    if (has(combinedContext, /\b(dent|stomatolog|ortodon|higienizacja|wybielanie)\b/i)) {
      return resolve(CATEGORY.HEALTH, SUB.dentysta, categoriesArray);
    }
    return resolve(CATEGORY.HEALTH, SUB.lekarz, categoriesArray);
  }
  if (isGymIssuer || has(combinedContext, /\b(karnet|silownia|fitness|trening|joga|pilates|basen)\b/i)) {
    return resolve(CATEGORY.HEALTH, SUB.silownia, categoriesArray);
  }
  if (has(combinedContext, /\b(fryzjer|barber|koloryzacja|strzyzenie)\b/i)) {
    return resolve(CATEGORY.HEALTH, SUB.fryzjer, categoriesArray);
  }
  if (has(combinedContext, /\b(spa|masaz|masaż|sauna|zabieg relaksacyjny)\b/i)) {
    return resolve(CATEGORY.HEALTH, SUB.spa, categoriesArray);
  }
  if (has(combinedContext, /\b(serum|krem do twarzy|tonik|peeling do twarzy|maska do twarzy)\b/i)) {
    return resolve(CATEGORY.HEALTH, SUB.twarz, categoriesArray);
  }
  if (isDrugstoreIssuer && has(combinedContext, /\b(perfum|woda perfumowana|eau de parfum|zapach)\b/i)) {
    return resolve(CATEGORY.HEALTH, SUB.perfumy, categoriesArray);
  }
  if (isDrugstoreIssuer && has(combinedContext, /\b(podklad|tusz|pomadka|roz|eyeliner|makijaz)\b/i)) {
    return resolve(CATEGORY.HEALTH, SUB.kosmetyki, categoriesArray);
  }

  // Task 4: Wykrywanie używanej odzieży - before regular clothing detection
  if (isUsedClothing) {
    const result = has(combinedContext, /\b(dzieci|child|kid|baby|niemowle)\b/i)
      ? resolve(CATEGORY.CLOTHES, SUB.odziezDziecieca, categoriesArray)
      : resolve(CATEGORY.CLOTHES, SUB.odziez, categoriesArray);
    // Cache result
    if (heuristicCache.size >= HEURISTIC_CACHE_MAX_SIZE) {
      const firstKey = heuristicCache.keys().next().value;
      if (firstKey) heuristicCache.delete(firstKey);
    }
    heuristicCache.set(cacheKey, result);
    return result;
  }

  if (isClothingIssuer || has(combinedContext, /\b(kurtka|bluza|spodnie|sukienka|koszula|t-shirt|sweter)\b/i)) {
    if (has(combinedContext, /\b(legginsy sportowe|buty biegowe|dres|sport bra)\b/i)) {
      return resolve(CATEGORY.CLOTHES, SUB.odziezSportowa, categoriesArray);
    }
    if (has(combinedContext, /\b(body|pajacyk|ubranka dzieciece|kurteczka dzieci)\b/i)) {
      return resolve(CATEGORY.CLOTHES, SUB.odziezDziecieca, categoriesArray);
    }
    return resolve(CATEGORY.CLOTHES, SUB.odziez, categoriesArray);
  }
  if (isClothingIssuer && has(combinedContext, /\b(buty|trampki|adidasy|kozaki|sneakers|sandaly)\b/i)) {
    return resolve(CATEGORY.CLOTHES, SUB.obuwie, categoriesArray);
  }
  if (has(combinedContext, /\b(torebka|plecak|czapka|rekawiczki|pasek|zegarek|okulary)\b/i)) {
    return resolve(CATEGORY.CLOTHES, SUB.akcesoria, categoriesArray);
  }
  if (has(combinedContext, /\b(biustonosz|majtki|skarpety|rajstopy|piżama|pizama)\b/i)) {
    return resolve(CATEGORY.CLOTHES, SUB.bielizna, categoriesArray);
  }

  if (isMarketplaceIssuer || isElectronicsIssuer || has(combinedContext, /\b(kurier|przesylka|shipping|shipment|marketplace)\b/i)) {
    if (has(combinedContext, /\b(koszt dostawy|przesylka|dostawa|kurier|paczkomat)\b/i)) {
      return resolve(CATEGORY.ONLINE, SUB.dostawa, categoriesArray);
    }
    if (isElectronicsIssuer || has(combinedContext, /\b(sluchawki|laptop|monitor|telefon komorkowy|tablet|klawiatura|myszka|drukarka)\b/i)) {
      return resolve(CATEGORY.ONLINE, SUB.elektronika, categoriesArray);
    }
    if (has(combinedContext, /\b(ksiazka|ebook|film|plyta|gra)\b/i)) {
      return resolve(CATEGORY.ONLINE, SUB.ksiazkiMedia, categoriesArray);
    }
    if (has(combinedContext, /\b(krem|kosmetyki|szampon|perfumy)\b/i)) {
      return resolve(CATEGORY.ONLINE, SUB.urodaOnline, categoriesArray);
    }
    if (has(combinedContext, /\b(meble|garnek|posciel|narzedzia|doniczka|lampka)\b/i)) {
      return resolve(CATEGORY.ONLINE, SUB.domOgrod, categoriesArray);
    }
    return resolve(CATEGORY.ONLINE, SUB.marketplace, categoriesArray);
  }

  if (isBusinessIssuer) {
    if (has(combinedContext, /\b(delegacja|nocleg sluzbowy|podroz sluzbowa|dieta delegacyjna)\b/i)) {
      return resolve(CATEGORY.BUSINESS, SUB.delegacje, categoriesArray);
    }
    if (has(combinedContext, /\b(ksiegowosc|biuro rachunkowe|vat|pit|faktura ksiegowa)\b/i)) {
      return resolve(CATEGORY.BUSINESS, SUB.ksiegowosc, categoriesArray);
    }
    if (has(combinedContext, /\b(papier|segregator|dlugopis|zeszyt firmowy|tusz do drukarki)\b/i)) {
      return resolve(CATEGORY.BUSINESS, SUB.biuroMaterialy, categoriesArray);
    }
    if (has(combinedContext, /\b(printer|monitor biurowy|krzeslo biurowe|sprzet biurowy|laptop firmowy)\b/i)) {
      return resolve(CATEGORY.BUSINESS, SUB.biuroSprzet, categoriesArray);
    }
  }

  if (isBankOrInsuranceIssuer || has(combinedContext, /\b(prowizja|oplata bankowa|ubezpieczenie|podatek|mandat skarbowy)\b/i)) {
    if (has(combinedContext, /\b(podatek|pit|cit|vat|urzad skarbowy)\b/i)) {
      return resolve(CATEGORY.FINANCE, SUB.podatki, categoriesArray);
    }
    if (has(combinedContext, /\b(rata|kredyt|pozyczka|leasing)\b/i)) {
      return resolve(CATEGORY.FINANCE, SUB.kredyt, categoriesArray);
    }
    if (has(combinedContext, /\b(oszczednosci|lokata)\b/i)) {
      return resolve(CATEGORY.FINANCE, SUB.oszczednosci, categoriesArray);
    }
    if (has(combinedContext, /\b(inwest|fundusz|broker)\b/i)) {
      return resolve(CATEGORY.FINANCE, SUB.inwestycje, categoriesArray);
    }
    if (has(combinedContext, /\b(ubezpieczenie)\b/i)) {
      return resolve(CATEGORY.FINANCE, SUB.ubezpieczenie, categoriesArray);
    }
    return resolve(CATEGORY.FINANCE, SUB.bank, categoriesArray);
  }

  if (has(combinedContext, /\b(kwiat|bukiet|swieca zapachowa|prezent|voucher prezentowy)\b/i)) {
    return resolve(CATEGORY.OTHER, SUB.prezenty, categoriesArray);
  }
  if (has(combinedContext, /\b(darowizna|fundacja|zbiorka|wplata charytatywna)\b/i)) {
    return resolve(CATEGORY.OTHER, SUB.darowizny, categoriesArray);
  }

  if (isCafeIssuer && has(text, /\b(kawa|coffee|espresso|americano|latte|cappuccino|flat white|macchiato|mocha|frappe|herbat|tea|matcha|ciast|sernik|deser|muffin|brownie|croissant|kanapk|sandw|lemoniad|napoj)\b/i)) {
    return resolve(CATEGORY.DINING, SUB.kawiarnia, categoriesArray);
  }
  if ((isRestaurantIssuer || isFastFoodIssuer || isPizzaIssuer || isSushiIssuer) && has(text, /\b(burger|frytki|wrap|kebab|zestaw|meal|combo|pizza|sushi|maki|nigiri|uramaki|ramen|pad thai|pierogi|schab|obiad|lunch|danie|zupa|makaron|salat|salad|napoj|cola|lemoniad|kawa|herbat|ciast)\b/i)) {
    if (isPizzaIssuer || has(combinedContext, /\b(pizza|margherita|pepperoni|hawajska)\b/i)) {
      return resolve(CATEGORY.DINING, SUB.pizza, categoriesArray);
    }
    if (isSushiIssuer || has(combinedContext, /\b(sushi|maki|nigiri|uramaki|hosomaki|futomaki)\b/i)) {
      return resolve(CATEGORY.DINING, SUB.sushi, categoriesArray);
    }
    if (isFastFoodIssuer || has(combinedContext, /\b(burger|frytki|kebab|wrap|nuggets|happy meal|mcflurry|zinger)\b/i)) {
      return resolve(CATEGORY.DINING, SUB.fastFood, categoriesArray);
    }
    return resolve(CATEGORY.DINING, SUB.restauracja, categoriesArray);
  }

  if (isGroceryIssuer || isBakeryIssuer) {
    if (isBakeryIssuer || has(text, /\b(chleb|bulka|bajgel|drozdzowka|croissant|bagietka|chalka|paczek)\b/i)) {
      return resolve(CATEGORY.FOOD, SUB.piekarnia, categoriesArray);
    }
    if (has(text, /\b(wedlin|szynka|kielbasa|parowk|mieso|kurczak|wolowina|schab|indyk)\b/i)) {
      return resolve(CATEGORY.FOOD, SUB.mieso, categoriesArray);
    }
    if (has(text, /\b(losos|tunczyk|sledz|dorsz|krewet|ryba|owoce morza)\b/i)) {
      return resolve(CATEGORY.FOOD, SUB.ryby, categoriesArray);
    }
    if (has(text, /\b(jogurt|mleko|maslo|ser|twarog|serek|smietan|kefir|jaja|jajka)\b/i)) {
      return resolve(CATEGORY.FOOD, SUB.nabial, categoriesArray);
    }
    if (has(text, /\b(mrozon|lody|pizza mrozona|warzywa na patelnie)\b/i)) {
      return resolve(CATEGORY.FOOD, SUB.mrozonki, categoriesArray);
    }
    if (has(text, /\b(rukola|surowka|pomidor|ogorek|salata|warzyw|owoc|banan|jablko|truskawk|ziemniak)\b/i)) {
      return resolve(CATEGORY.FOOD, SUB.owoce, categoriesArray);
    }
    if (has(text, /\b(makaron|ryz|maka|kasza|platki|granola|musli|cukier|sol)\b/i)) {
      return resolve(CATEGORY.FOOD, SUB.sypkie, categoriesArray);
    }
    if (has(text, /\b(przyprawa|ketchup|musztarda|majonez|sos|oliwa|olej)\b/i)) {
      return resolve(CATEGORY.FOOD, SUB.przyprawy, categoriesArray);
    }
    if (has(text, /\b(chips|chrupk|paluszki|baton|czekolad|cukierk|wafel|zelki|ciastk|orzeszk)\b/i)) {
      return resolve(CATEGORY.FOOD, SUB.slodycze, categoriesArray);
    }
    if (has(text, /\b(woda|sok|cola|pepsi|sprite|fanta|napoj|lemoniad)\b/i)) {
      return resolve(CATEGORY.FOOD, SUB.napoje, categoriesArray);
    }
    if (has(text, /\b(kawa|coffee|espresso|americano|latte|herbat|tea|matcha)\b/i)) {
      return resolve(CATEGORY.FOOD, SUB.kawaHerbata, categoriesArray);
    }
    if (has(text, /\b(piwo|lager|ipa|porter|pils|ale\b|wino|whisk|gin\b|vodka)\b/i)) {
      return resolve(CATEGORY.FOOD, SUB.alkohol, categoriesArray);
    }
    if (has(text, /\b(gotowe danie|pierogi|zupa instant|lasagne|salatka gotowa|kanapka gotowa)\b/i)) {
      return resolve(CATEGORY.FOOD, SUB.gotoweDania, categoriesArray);
    }
    if (has(text, /\b(bio|eko|organic|vege|vegan|bezgluten)\b/i)) {
      return resolve(CATEGORY.FOOD, SUB.bio, categoriesArray);
    }
    return resolve(CATEGORY.FOOD, isGroceryIssuer ? SUB.supermarket : SUB.delikatesy, categoriesArray);
  }

  if (isHomeIssuer || has(text, /\b(donicz|ziemia|nawoz|zarowka|mebel|poduszka|posciel|pojemnik|narzedz|wiert|mlotek|farba|pedzel|balkon|ogrod|garnek|patelnia|talerz|dekoracja)\b/i)) {
    if (has(combinedContext, /\b(donicz|ziemia|nawoz|balkon|ogrod|roslin|krzew|kwiat)\b/i)) {
      return resolve(CATEGORY.HOME, SUB.ogrod, categoriesArray);
    }
    if (has(combinedContext, /\b(narzedz|wiert|mlotek|farba|pedzel|remont|kabel|silikon|plytka)\b/i)) {
      return resolve(CATEGORY.HOME, SUB.remonty, categoriesArray);
    }
    if (has(combinedContext, /\b(garnek|patelnia|miska|talerz|kubek|noz kuchenny|deska do krojenia)\b/i)) {
      return resolve(CATEGORY.HOME, SUB.kuchnia, categoriesArray);
    }
    if (has(combinedContext, /\b(ramka|swiecznik|plakat|poduszka dekoracyjna|zaslona)\b/i)) {
      return resolve(CATEGORY.HOME, SUB.dekoracje, categoriesArray);
    }
    if (has(combinedContext, /\b(mebel|krzeslo|stol|komoda|lampa|polka|szafa)\b/i)) {
      return resolve(CATEGORY.HOME, SUB.wyposazenie, categoriesArray);
    }
    return resolve(CATEGORY.HOME, SUB.wyposazenie, categoriesArray);
  }

  if (isDrugstoreIssuer || has(text, /\b(szampon|odzywk|zel pod prysznic|mydlo|pasta do zeb|szczoteczka|dezodorant|papier toaletowy|recznik papierowy|plyn do szyb|proszek do prania)\b/i)) {
    if (has(combinedContext, /\b(proszek|plyn do prania|kapsulki do prania|odplamiacz|plyn do plukania)\b/i)) {
      return resolve(CATEGORY.HOUSEHOLD, SUB.pranie, categoriesArray);
    }
    if (has(combinedContext, /\b(tabletki do zmywarki|plyn do naczyn|sol do zmywarki|nabyszczacz)\b/i)) {
      return resolve(CATEGORY.HOUSEHOLD, SUB.zmywanie, categoriesArray);
    }
    if (has(combinedContext, /\b(papier toaletowy|recznik papierowy|chusteczki higieniczne)\b/i)) {
      return resolve(CATEGORY.HOUSEHOLD, SUB.papier, categoriesArray);
    }
    if (has(combinedContext, /\b(kostka wc|zel wc|plyn do wc)\b/i)) {
      return resolve(CATEGORY.HOUSEHOLD, SUB.wc, categoriesArray);
    }
    if (has(combinedContext, /\b(odswiezacz|swieca zapachowa|patyczki zapachowe)\b/i)) {
      return resolve(CATEGORY.HOUSEHOLD, SUB.odswiezacze, categoriesArray);
    }
    if (has(combinedContext, /\b(pieluchy|chusteczki dla niemowlat|podklad do przewijania)\b/i)) {
      return resolve(CATEGORY.HOUSEHOLD, SUB.higienaDzieci, categoriesArray);
    }
    if (has(combinedContext, /\b(podpaski|tampony|kubeczek menstruacyjny|wkladki higieniczne)\b/i)) {
      return resolve(CATEGORY.HOUSEHOLD, SUB.higienaIntymna, categoriesArray);
    }
    if (has(combinedContext, /\b(szampon|mydlo|pasta do zeb|szczoteczka|dezodorant|maszynka do golenia)\b/i)) {
      return resolve(CATEGORY.HOUSEHOLD, SUB.higienaOsobista, categoriesArray);
    }
    if (has(combinedContext, /\b(balsam|maslo do ciala|krem do rak|olejek do ciala)\b/i)) {
      return resolve(CATEGORY.HOUSEHOLD, SUB.pielegnacjaCiala, categoriesArray);
    }
    if (has(combinedContext, /\b(perfum|woda toaletowa|eau de parfum)\b/i)) {
      return resolve(CATEGORY.HOUSEHOLD, SUB.perfumyZapachy, categoriesArray);
    }
    if (has(combinedContext, /\b(tusz|pomadka|cien do powiek|podklad|puder|roz)\b/i)) {
      return resolve(CATEGORY.HOUSEHOLD, SUB.kosmetykiMakijaz, categoriesArray);
    }
    if (has(combinedContext, /\b(pletwa|mop|domestos|plyn do szyb|mleczko czyszczace|srodek czystosci|gabka)\b/i)) {
      return resolve(CATEGORY.HOUSEHOLD, SUB.srodkiCzystosci, categoriesArray);
    }
    return resolve(CATEGORY.HOUSEHOLD, SUB.higienaOsobista, categoriesArray);
  }

  // Cache the result (including null for no match)
  if (heuristicCache.size >= HEURISTIC_CACHE_MAX_SIZE) {
    // Clear oldest entries when cache is full
    const firstKey = heuristicCache.keys().next().value;
    if (firstKey) heuristicCache.delete(firstKey);
  }
  heuristicCache.set(cacheKey, null);

  return null;
}
