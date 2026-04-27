"use node";

import { CategoryResolution, CATEGORY, SUB, has, resolve } from "./constants";
import { IssuerFlags } from "./issuers";

/** Żywność i napoje + Restauracje i kawiarnie */
export function matchFood(text: string, combinedContext: string, issuers: IssuerFlags, categoriesArray: any[]): CategoryResolution | null {
  const { isFoodDeliveryIssuer, isCafeIssuer, isRestaurantIssuer, isFastFoodIssuer, isPizzaIssuer, isSushiIssuer, isGroceryIssuer, isBakeryIssuer } = issuers;

  if (isFoodDeliveryIssuer) return resolve(CATEGORY.DINING, SUB.dostawaJedzenia, categoriesArray);

  if (isCafeIssuer && has(text, /\b(kawa|coffee|espresso|americano|latte|cappuccino|flat white|macchiato|mocha|frappe|herbat|tea|matcha|ciast|sernik|deser|muffin|brownie|croissant|kanapk|sandw|lemoniad|napoj)\b/i)) {
    return resolve(CATEGORY.DINING, SUB.kawiarnia, categoriesArray);
  }

  if ((isRestaurantIssuer || isFastFoodIssuer || isPizzaIssuer || isSushiIssuer) && has(text, /\b(burger|frytki|wrap|kebab|zestaw|meal|combo|pizza|sushi|maki|nigiri|ramen|pad thai|pierogi|schab|obiad|lunch|danie|zupa|makaron|salat|napoj|cola|kawa|herbat|ciast)\b/i)) {
    if (isPizzaIssuer || has(combinedContext, /\b(pizza|margherita|pepperoni|hawajska)\b/i)) return resolve(CATEGORY.DINING, SUB.pizza, categoriesArray);
    if (isSushiIssuer || has(combinedContext, /\b(sushi|maki|nigiri|uramaki)\b/i)) return resolve(CATEGORY.DINING, SUB.sushi, categoriesArray);
    if (isFastFoodIssuer || has(combinedContext, /\b(burger|frytki|kebab|wrap|nuggets|happy meal)\b/i)) return resolve(CATEGORY.DINING, SUB.fastFood, categoriesArray);
    return resolve(CATEGORY.DINING, SUB.restauracja, categoriesArray);
  }

  if (isGroceryIssuer || isBakeryIssuer) {
    if (isBakeryIssuer || has(text, /\b(chleb|bulka|bajgel|drozdzowka|croissant|bagietka|chalka|paczek)\b/i)) return resolve(CATEGORY.FOOD, SUB.piekarnia, categoriesArray);
    if (has(text, /\b(wedlin|szynk|kielbas|parowk|mieso|mies|kurczak|kurczek|wolowina|schab|indyk|bekon|salami|boczek|poledwic|kark|filet|mielone|pasztet|kaszank|kabanos)\b/i)) return resolve(CATEGORY.FOOD, SUB.mieso, categoriesArray);
    if (has(text, /\b(losos|tunczyk|sledz|dorsz|krewet|ryb[ay]|makrela|pstrag|mintaj|miruna|karp|owoce morza)\b/i)) return resolve(CATEGORY.FOOD, SUB.ryby, categoriesArray);
    if (has(text, /\b(jogurt|mleko|maslo|ser\b|sery\b|serek|twarog|smietan|kefir|jaj[ka]|jajko|mozzarella|feta|gouda|edam|camembert|skyr|deser mleczny)\b/i)) return resolve(CATEGORY.FOOD, SUB.nabial, categoriesArray);
    if (has(text, /\b(mrozon|lody|pizza mrozona|frytki mroz|warzywa mroz|paluszki rybne)\b/i)) return resolve(CATEGORY.FOOD, SUB.mrozonki, categoriesArray);
    if (has(text, /\b(rukola|surowka|pomidor|ogorek|salat[ak]|warzyw|owoc|banan|jablk|truskawk|ziemniak|cebul|marchew|kapust|papryka|pieczark|szpinak|broku|kalafior|dyni|por\b|rzodkiew|seler|awokado|mango|gruszk|sliwk|malin|borowk|winogrono|ananas|arbuz|cytry|pomarancz|kiwi|burak)\b/i)) return resolve(CATEGORY.FOOD, SUB.owoce, categoriesArray);
    if (has(text, /\b(makaron|ryz|maka|kasza|platki|granola|musli|cukier\b|sol\b|otreb|bulgur|kuskus|soczewic|ciecierzyc|fasol|groch)\b/i)) return resolve(CATEGORY.FOOD, SUB.sypkie, categoriesArray);
    if (has(text, /\b(przyprawa|ketchup|musztard|majone|sos\b|oliwa|olej\b|ocet|oregano|bazylia|pieprz|curry|papryka slodka|chrzan|koncentrat|bulion)\b/i)) return resolve(CATEGORY.FOOD, SUB.przyprawy, categoriesArray);
    if (has(text, /\b(chips|chipsy|chrupk|paluszk|baton|czekolad|cukierk|wafel|zelki|ciastk|orzeszk|orzech|krakers|precel|popcorn|ptasie mleczko|delicje|herbatnik|biszkopt)\b/i)) return resolve(CATEGORY.FOOD, SUB.slodycze, categoriesArray);
    if (has(text, /\b(woda\b|sok\b|cola\b|pepsi|sprite|fanta|napoj|lemoniad|ice tea|schweppes|red bull|energetyk|monster|tiger|oranzad|oranazad)\b/i)) return resolve(CATEGORY.FOOD, SUB.napoje, categoriesArray);
    if (has(text, /\b(kawa\b|kawy\b|coffee|espresso|americano|latte|herbat|tea\b|matcha|cappuccino|nescafe|inka|jacobs|lavazza|tchibo)\b/i)) return resolve(CATEGORY.FOOD, SUB.kawaHerbata, categoriesArray);
    if (has(text, /\b(piwo|lager|ipa\b|porter|pils|ale\b|wino|whisk|gin\b|vodka|wodka|rum\b|likier|cydr|szampan|prosecco|aperol|brandy|koniak|tequila|bourbon)\b/i)) return resolve(CATEGORY.FOOD, SUB.alkohol, categoriesArray);
    if (has(text, /\b(gotowe danie|pierogi|pierogow|zupa instant|lasagne|nalesnik|krokiet|tortilla|wrap|salatka gotowa|kanapka|hummus|pizza gotowa)\b/i)) return resolve(CATEGORY.FOOD, SUB.gotoweDania, categoriesArray);
    if (has(text, /\b(bio|eko|organic|vege|vegan|bezgluten)\b/i)) return resolve(CATEGORY.FOOD, SUB.bio, categoriesArray);
    return resolve(CATEGORY.FOOD, isGroceryIssuer ? SUB.supermarket : SUB.delikatesy, categoriesArray);
  }

  return null;
}

/** Standalone food matching (no store context) */
export function matchFoodStandalone(text: string, categoriesArray: any[]): CategoryResolution | null {
  if (has(text, /\b(wedlin|szynk|kielbas|parowk|mieso|mies|kurczak|kurczek|wolowina|schab|indyk|bekon|salami|boczek|poledwic|kark|filet|udziec|skrzydel|mielone|pasztet|kaszank|kabanos)\b/i)) return resolve(CATEGORY.FOOD, SUB.mieso, categoriesArray);
  if (has(text, /\b(losos|tunczyk|sledz|dorsz|krewet|ryb[ay]|owoce morza|pstrag|makrela|mintaj|miruna|karp)\b/i)) return resolve(CATEGORY.FOOD, SUB.ryby, categoriesArray);
  if (has(text, /\b(jogurt|mleko|maslo|ser\b|sery\b|serek|twarog|smietan|kefir|jaj[ka]|jajko|jajka|mozzarella|feta|gouda|edam|camembert|skyr)\b/i)) return resolve(CATEGORY.FOOD, SUB.nabial, categoriesArray);
  if (has(text, /\b(chleb|bulka|bulki|bajgel|drozdzow|croissant|bagietk|chalk|paczek|rogal|pieczywo)\b/i)) return resolve(CATEGORY.FOOD, SUB.piekarnia, categoriesArray);
  if (has(text, /\b(pomidor|ogorek|ogork|salat[ak]|warzyw|owoc|banan|jablk|truskawk|ziemniak|cebul|marchew|kapust|papryka|rukola|surowk|pieczark|grzyb|szpinak|broku|kalafior|dyni|por\b|rzodkiew|seler|awokado|mango|gruszk|sliwk|malin|borowk|winogrono|ananas|arbuz|cytry|pomarancz|kiwi)\b/i)) return resolve(CATEGORY.FOOD, SUB.owoce, categoriesArray);
  if (has(text, /\b(makaron|ryz|maka|kasza|platki|granola|musli|cukier\b|sol\b|otreb|bulgur|kuskus|soczewic|ciecierzyc|fasol|groch)\b/i)) return resolve(CATEGORY.FOOD, SUB.sypkie, categoriesArray);
  if (has(text, /\b(przyprawa|ketchup|musztard|majone|sos\b|oliwa|olej\b|ocet|oregano|bazylia|pieprz|curry)\b/i)) return resolve(CATEGORY.FOOD, SUB.przyprawy, categoriesArray);
  if (has(text, /\b(chips|chipsy|chrupk|paluszk|baton|czekolad|cukierk|wafel|zelki|ciastk|orzeszk|orzech|krakers|precel|popcorn|ptasie mleczko)\b/i)) return resolve(CATEGORY.FOOD, SUB.slodycze, categoriesArray);
  if (has(text, /\b(mrozon|lody|pizza mrozona|mrozony|mrozonka)\b/i)) return resolve(CATEGORY.FOOD, SUB.mrozonki, categoriesArray);
  if (has(text, /\b(gotowe danie|pierogi|pierogow|zupa instant|lasagne|nalesnik|krokiet|tortilla|wrap|salatka gotowa|kanapka|hummus|pizza gotowa)\b/i)) return resolve(CATEGORY.FOOD, SUB.gotoweDania, categoriesArray);
  if (has(text, /\b(bio\b|eko\b|organic|vege\b|vegan|bezgluten)\b/i)) return resolve(CATEGORY.FOOD, SUB.bio, categoriesArray);
  if (has(text, /\b(woda\b|sok\b|cola\b|pepsi|sprite|fanta|napoj|lemoniad|ice tea|schweppes|red bull|energetyk|monster|tiger)\b/i)) return resolve(CATEGORY.FOOD, SUB.napoje, categoriesArray);
  if (has(text, /\b(kawa\b|kawy\b|coffee|espresso|americano|latte|herbat|tea\b|matcha|cappuccino|nescafe|inka|jacobs)\b/i)) return resolve(CATEGORY.FOOD, SUB.kawaHerbata, categoriesArray);
  if (has(text, /\b(piwo|lager|ipa\b|porter|pils|ale\b|wino|whisk|gin\b|vodka|wodka|rum\b|likier|cydr|szampan|prosecco|aperol|brandy|koniak|tequila|bourbon)\b/i)) return resolve(CATEGORY.FOOD, SUB.alkohol, categoriesArray);
  return null;
}
