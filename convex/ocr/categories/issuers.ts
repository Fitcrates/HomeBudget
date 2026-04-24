"use node";

import { has } from "./constants";

export interface IssuerFlags {
  isGroceryIssuer: boolean;
  isBakeryIssuer: boolean;
  isCafeIssuer: boolean;
  isRestaurantIssuer: boolean;
  isFastFoodIssuer: boolean;
  isPizzaIssuer: boolean;
  isSushiIssuer: boolean;
  isFoodDeliveryIssuer: boolean;
  isDrugstoreIssuer: boolean;
  isPharmacyIssuer: boolean;
  isPetIssuer: boolean;
  isHomeIssuer: boolean;
  isClothingIssuer: boolean;
  isUsedClothing: boolean;
  isBookIssuer: boolean;
  isToyIssuer: boolean;
  isElectronicsIssuer: boolean;
  isMarketplaceIssuer: boolean;
  isFuelIssuer: boolean;
  isParkingIssuer: boolean;
  isTaxiIssuer: boolean;
  isRailIssuer: boolean;
  isFlightIssuer: boolean;
  isMedicalIssuer: boolean;
  isGymIssuer: boolean;
  isCinemaIssuer: boolean;
  isStreamingIssuer: boolean;
  isTravelIssuer: boolean;
  isSchoolIssuer: boolean;
  isTelcoIssuer: boolean;
  isUtilityIssuer: boolean;
  isBankOrInsuranceIssuer: boolean;
  isBusinessIssuer: boolean;
}

export function isCloudOrBusinessSaaSIssuer(text: string): boolean {
  return /\b(railway|vercel|render|fly\.io|digitalocean|linode|supabase|firebase|cloudflare|netlify|aws|amazon web services|gcp|google cloud|azure|mongodb atlas|planetscale|neon|upstash|replicate|openai|anthropic|resend|posthog|sentry|datadog|new relic|clerk|auth0|github|gitlab|atlassian|notion|slack|zoom|figma|canva|miro)\b/i.test(text);
}

export function isBusinessSaaSLine(text: string, combinedContext: string): boolean {
  const infra = /\b(vcpu|cpu|memory|ram|disk|storage|bandwidth|egress|ingress|container|instance|compute|runtime|build minutes?|deployment|hosting|backend|server|database|postgres|redis|cdn|domain|ssl|smtp|workspace|seat|seats|monitoring|observability|log ingestion|network transfer|api usage|invoice|billing|subscription)\b/i;
  const plan = /\b(pro|team|starter|hobby|developer|enterprise)\s+plan\b/i;
  return infra.test(text) || (plan.test(text) && isCloudOrBusinessSaaSIssuer(combinedContext));
}

export function detectIssuers(receiptContext: string): IssuerFlags {
  return {
    isGroceryIssuer: has(receiptContext, /(biedronka|lidl|kaufland|auchan|carrefour|stokrot|netto|dino|zabka|spar|aldi|lewiatan|intermarche|supermarket|dyskont|delikates|frisco|e\.?leclerc)/i),
    isBakeryIssuer: has(receiptContext, /(piekarni|piekarnia|cukiernia|putka|lubaszka|delekta|grycan|vinci|bakery)/i),
    isCafeIssuer: has(receiptContext, /(kawiar|cafe\b|coffee\b|starbucks|costa|green caffe|nero|etno|so coffee|coffeedesk|cukierni|pijalni|palarni)/i),
    isRestaurantIssuer: has(receiptContext, /(restaur|bistro|bar\b|oberza|karczm|trattor|ramen|kebab|burger|mcdonald|kfc|subway|pizzer|pizza|sushi|thai|noodle|food truck)/i),
    isFastFoodIssuer: has(receiptContext, /(mcdonald|kfc|subway|burger king|burger|kebab|drive|fast food)/i),
    isPizzaIssuer: has(receiptContext, /(pizzer|pizza|telepizza|domino)/i),
    isSushiIssuer: has(receiptContext, /(sushi|maki|nigiri|uramaki)/i),
    isFoodDeliveryIssuer: has(receiptContext, /(wolt|glovo|ubereats|pyszne|bolt food)/i),
    isDrugstoreIssuer: has(receiptContext, /(rossmann|hebe|super.?pharm|douglas|sephora)/i),
    isPharmacyIssuer: has(receiptContext, /(apteka|doz|ziko|gemini|cefarm|dr\.?\s?max)/i),
    isPetIssuer: has(receiptContext, /(zoo|pet|kakadu|maxi zoo|weteryn)/i),
    isHomeIssuer: has(receiptContext, /(castorama|leroy|obi|ikea|jysk|agata|mebl|ogrodnicz|bricomarche|pepco|action|homla|home&you)/i),
    isClothingIssuer: has(receiptContext, /(hm\b|h&m|reserved|cropp|house\b|sinsay|zara|mohito|ccc|deichmann|halfprice|tk maxx|answear|zalando|eobuwie|modivo)/i),
    isUsedClothing: has(receiptContext, /\b(uzyw|used|second.?hand|outlet|stock|deca)\b/i),
    isBookIssuer: has(receiptContext, /(empik|matras|swiat ksiazki|bookstore|ksiegarnia)/i),
    isToyIssuer: has(receiptContext, /(smyk|toys|zabawki|lego store)/i),
    isElectronicsIssuer: has(receiptContext, /(media expert|media markt|rtv euro agd|x-kom|komputronik|apple|samsung|morele|neonet)/i),
    isMarketplaceIssuer: has(receiptContext, /(allegro|amazon|ebay|olx|etsy|temu|aliexpress)/i),
    isFuelIssuer: has(receiptContext, /(orlen|bp\b|shell|circle k|amic|moya|lotos|stacja paliw)/i),
    isParkingIssuer: has(receiptContext, /(parking|skycash|citypark|parkomat|apcoa|parkmobile)/i),
    isTaxiIssuer: has(receiptContext, /(uber|bolt|freenow|taxi)/i),
    isRailIssuer: has(receiptContext, /(pkp|intercity|koleje|polregio|trainline)/i),
    isFlightIssuer: has(receiptContext, /(ryanair|wizz|lot polish|lufthansa|booking flight|airlines|air france|easyjet)/i),
    isMedicalIssuer: has(receiptContext, /(medicover|luxmed|enel|diagnostyka|lab|przychodnia|szpital|stomatolog|dent|ortodon|fizjo)/i),
    isGymIssuer: has(receiptContext, /(gym|fitness|calypso|medicover sport|multisport|silownia|crossfit|basen)/i),
    isCinemaIssuer: has(receiptContext, /(multikino|cinema city|helios|teatr|opera|filharmonia)/i),
    isStreamingIssuer: has(receiptContext, /(netflix|spotify|youtube premium|hbo|max\b|disney|prime video|tidal|storytel|legimi|bookbeat)/i),
    isTravelIssuer: has(receiptContext, /(booking\.com|airbnb|expedia|trivago|itaka|rainbow|travelplanet|hotel|resort|apartamenty|wakacje)/i),
    isSchoolIssuer: has(receiptContext, /(szkola|uczelnia|uniwersytet|udemy|coursera|edx|language school|novakid|preply)/i),
    isTelcoIssuer: has(receiptContext, /(orange|play\b|plus\b|tmobile|t-mobile|vectra|inea|upc|netia)/i),
    isUtilityIssuer: has(receiptContext, /(tauron|enea|energa|pge|pgnig|veolia|mpwik|wodociagi|czynsz|spoldzielnia|wspolnota)/i),
    isBankOrInsuranceIssuer: has(receiptContext, /(pzu|allianz|warta|generali|link4|ergo hestia|bank|mbank|ing\b|santander|pekao|millennium|revolut|visa|mastercard|ubezpieczenie)/i),
    isBusinessIssuer: isCloudOrBusinessSaaSIssuer(receiptContext) || has(receiptContext, /(biuro|ksiegow|faktura|delegacja|hotel firmowy|drukarnia|papierniczy)/i),
  };
}
