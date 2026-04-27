"use node";

import { CategoryResolution, CATEGORY, SUB, has, resolve } from "./constants";
import { IssuerFlags } from "./issuers";

/** Zdrowie i uroda */
export function matchHealth(text: string, combinedContext: string, issuers: IssuerFlags, categoriesArray: any[]): CategoryResolution | null {
  const { isPharmacyIssuer, isMedicalIssuer, isGymIssuer } = issuers;

  if (isPharmacyIssuer || has(text, /\b(lek\b|leki\b|tablet|tabl|syrop|kaps|suplement|wit\b|vit\b|masc|krem lecz|plaster|termometr|ibuprom|apap|paracetamol|rutinoscorbin|electrolyte|elektrolit|magnez|omega|tran\b|probiotyk|krople|spray do nosa)\b/i)) return resolve(CATEGORY.HEALTH, SUB.apteka, categoriesArray);
  if (isMedicalIssuer || has(combinedContext, /\b(konsultacja|badanie|przychodnia|laboratorium|usg|rehabilitacja|fizjoterapia)\b/i)) {
    if (has(combinedContext, /\b(dent|stomatolog|ortodon|higienizacja|wybielanie)\b/i)) return resolve(CATEGORY.HEALTH, SUB.dentysta, categoriesArray);
    return resolve(CATEGORY.HEALTH, SUB.lekarz, categoriesArray);
  }
  if (isGymIssuer || has(combinedContext, /\b(karnet|silownia|fitness|trening|joga|pilates|basen)\b/i)) return resolve(CATEGORY.HEALTH, SUB.silownia, categoriesArray);
  if (has(combinedContext, /\b(fryzjer|barber|koloryzacja|strzyzenie)\b/i)) return resolve(CATEGORY.HEALTH, SUB.fryzjer, categoriesArray);
  if (has(combinedContext, /\b(spa|masaz|masaż|sauna|zabieg relaksacyjny)\b/i)) return resolve(CATEGORY.HEALTH, SUB.spa, categoriesArray);
  if (has(combinedContext, /\b(serum|krem do twarzy|tonik|peeling do twarzy|maska do twarzy|retinol|kwas hialuro|spf\b|filtr do twarzy)\b/i)) return resolve(CATEGORY.HEALTH, SUB.twarz, categoriesArray);

  return null;
}

/** Standalone health matching */
export function matchHealthStandalone(text: string, categoriesArray: any[]): CategoryResolution | null {
  if (has(text, /\b(lek\b|leki\b|tablet|tabl|syrop|kaps|suplement|wit\b|vit\b|masc|krem lecz|plaster|termometr|ibuprom|paracetamol|apap|rutinoscorbin|vitamina|magnez|omega|tran\b|probiotyk|elektrolit|krople|spray do nosa)\b/i)) return resolve(CATEGORY.HEALTH, SUB.apteka, categoriesArray);
  if (has(text, /\b(serum|krem do twarzy|tonik|peeling do twarzy|maska do twarzy|retinol|kwas hialuro|spf\b|filtr do twarzy)\b/i)) return resolve(CATEGORY.HEALTH, SUB.twarz, categoriesArray);
  return null;
}
