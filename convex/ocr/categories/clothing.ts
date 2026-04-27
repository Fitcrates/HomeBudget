"use node";

import { CategoryResolution, CATEGORY, SUB, has, resolve } from "./constants";
import { IssuerFlags } from "./issuers";

/** Ubrania i obuwie */
export function matchClothing(text: string, combinedContext: string, issuers: IssuerFlags, categoriesArray: any[]): CategoryResolution | null {
  const { isUsedClothing, isClothingIssuer } = issuers;

  if (isUsedClothing) {
    return has(combinedContext, /\b(dzieci|child|kid|baby|niemowle)\b/i)
      ? resolve(CATEGORY.CLOTHES, SUB.odziezDziecieca, categoriesArray)
      : resolve(CATEGORY.CLOTHES, SUB.odziez, categoriesArray);
  }

  if (isClothingIssuer || has(combinedContext, /\b(kurtka|bluza|spodnie|sukienka|koszula|t-shirt|sweter|plaszcz|kamizelka|szorty|legginsy|koszulka)\b/i)) {
    if (has(combinedContext, /\b(legginsy sportowe|buty biegowe|dres|sport bra|odziez sportowa|koszulka sportowa)\b/i)) return resolve(CATEGORY.CLOTHES, SUB.odziezSportowa, categoriesArray);
    if (has(combinedContext, /\b(body|pajacyk|ubranka dzieciece|kurteczka dzieci|spodnie dzieci|koszulka dzieci)\b/i)) return resolve(CATEGORY.CLOTHES, SUB.odziezDziecieca, categoriesArray);
    return resolve(CATEGORY.CLOTHES, SUB.odziez, categoriesArray);
  }
  if (isClothingIssuer && has(combinedContext, /\b(buty|trampki|adidasy|kozaki|sneakers|sandaly|klapki|polbuty|tenisowki|baleriny)\b/i)) return resolve(CATEGORY.CLOTHES, SUB.obuwie, categoriesArray);
  if (has(combinedContext, /\b(torebka|plecak|czapka|rekawiczki|pasek|zegarek|okulary|szalik|portfel|parasol)\b/i)) return resolve(CATEGORY.CLOTHES, SUB.akcesoria, categoriesArray);
  if (has(combinedContext, /\b(biustonosz|majtki|skarpety|rajstopy|piżama|pizama|bokserki|slip|bielizna)\b/i)) return resolve(CATEGORY.CLOTHES, SUB.bielizna, categoriesArray);

  return null;
}

/** Standalone clothing matching */
export function matchClothingStandalone(text: string, categoriesArray: any[]): CategoryResolution | null {
  if (has(text, /\b(buty|trampki|adidasy|kozaki|sneakers|sandaly|klapki|polbuty|tenisowki|baleriny)\b/i)) return resolve(CATEGORY.CLOTHES, SUB.obuwie, categoriesArray);
  if (has(text, /\b(kurtka|bluza|spodnie|sukienka|koszula|t-shirt|sweter|plaszcz|kamizelka|szorty|legginsy|dres|polar|koszulka)\b/i)) return resolve(CATEGORY.CLOTHES, SUB.odziez, categoriesArray);
  if (has(text, /\b(biustonosz|majtki|skarpety|rajstopy|pizama|bokserki|slip|bielizna)\b/i)) return resolve(CATEGORY.CLOTHES, SUB.bielizna, categoriesArray);
  if (has(text, /\b(torebka|plecak|czapka|rekawiczk|pasek|zegarek|okulary|szalik|portfel|parasol)\b/i)) return resolve(CATEGORY.CLOTHES, SUB.akcesoria, categoriesArray);
  return null;
}
