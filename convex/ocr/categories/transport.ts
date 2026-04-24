"use node";

import { CategoryResolution, CATEGORY, SUB, has, resolve } from "./constants";
import { IssuerFlags } from "./issuers";

/** Transport */
export function matchTransport(text: string, combinedContext: string, issuers: IssuerFlags, categoriesArray: any[]): CategoryResolution | null {
  const { isFuelIssuer, isParkingIssuer, isTaxiIssuer, isRailIssuer, isFlightIssuer } = issuers;

  if (isFuelIssuer || has(text, /\b(pb|pb95|pb98|on\b|diesel|adblue|paliwo|benzyna|olej napedowy|lpg)\b/i)) return resolve(CATEGORY.TRANSPORT, SUB.paliwo, categoriesArray);
  if (isParkingIssuer || has(text, /\b(parking|postoj|strefa platnego parkowania|parkomat)\b/i)) return resolve(CATEGORY.TRANSPORT, SUB.parking, categoriesArray);
  if (isTaxiIssuer || has(text, /\b(uber|bolt|taxi|przejazd)\b/i)) return resolve(CATEGORY.TRANSPORT, SUB.taxi, categoriesArray);
  if (isRailIssuer || has(text, /\b(pkp|intercity|bilet kolejowy|peron|wagon|train)\b/i)) return resolve(CATEGORY.TRANSPORT, SUB.pociag, categoriesArray);
  if (isFlightIssuer || has(text, /\b(lotnisko|bilet lotniczy|boarding|flight|airfare)\b/i)) return resolve(CATEGORY.TRANSPORT, SUB.samolot, categoriesArray);
  if (has(combinedContext, /\b(zkm|mpk|jakdojade|komunikacja miejska|bilet miejski|tramwaj|autobus|metro)\b/i)) return resolve(CATEGORY.TRANSPORT, SUB.komunikacja, categoriesArray);
  if (has(combinedContext, /\b(opony|warsztat|mechanik|wulkanizacja|przeglad|naprawa auta|serwis auta|myjnia|olej silnikowy|filtr kabinowy)\b/i)) return resolve(CATEGORY.TRANSPORT, SUB.serwisAuta, categoriesArray);
  if (has(combinedContext, /\b(oc\b|ac\b|autocasco|ubezpieczenie auta)\b/i)) return resolve(CATEGORY.TRANSPORT, SUB.autoUbezpieczenie, categoriesArray);

  return null;
}
