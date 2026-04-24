"use node";

import { CategoryResolution, CATEGORY, SUB, has, resolve } from "./constants";
import { IssuerFlags } from "./issuers";

/** Rozrywka i hobby + Edukacja */
export function matchLifestyle(text: string, combinedContext: string, issuers: IssuerFlags, categoriesArray: any[]): CategoryResolution | null {
  const { isTravelIssuer, isStreamingIssuer, isCinemaIssuer, isBookIssuer, isSchoolIssuer } = issuers;

  if (isTravelIssuer || has(combinedContext, /\b(hotel|nocleg|apartament|booking|wakacje|resort|camping|kemping|city break)\b/i)) return resolve(CATEGORY.FUN, SUB.wakacje, categoriesArray);

  if (isStreamingIssuer || has(text, /\b(subskrypcja|abonament premium|vod|streaming)\b/i)) {
    if (has(combinedContext, /\b(spotify|tidal|apple music)\b/i)) return resolve(CATEGORY.FUN, SUB.muzyka, categoriesArray);
    if (has(combinedContext, /\b(legimi|storytel|bookbeat)\b/i)) return resolve(CATEGORY.FUN, SUB.subskrypcje, categoriesArray);
    return resolve(CATEGORY.FUN, SUB.streaming, categoriesArray);
  }

  if (isCinemaIssuer || has(combinedContext, /\b(kino|teatr|musical|opera|koncert|standup)\b/i)) return resolve(CATEGORY.FUN, SUB.kino, categoriesArray);
  if (has(combinedContext, /\b(playstation|xbox|steam|epic games|nintendo|gra\b|game pass)\b/i)) return resolve(CATEGORY.FUN, SUB.gry, categoriesArray);
  if (isBookIssuer || has(combinedContext, /\b(ksiazka|audiobook|ebook|komiks|powiesc)\b/i)) return resolve(CATEGORY.FUN, SUB.ksiazki, categoriesArray);
  if (has(combinedContext, /\b(bilet|mecz|stadion|sport event|wejscie)\b/i)) return resolve(CATEGORY.FUN, SUB.biletySport, categoriesArray);
  if (has(combinedContext, /\b(farby plakatowe|modelarskie|pasmanteria|sztaluga|wloczka|instrument|ukulele|gitara|hobby)\b/i)) return resolve(CATEGORY.FUN, SUB.hobby, categoriesArray);

  // ── Edukacja ──
  if (isSchoolIssuer || has(combinedContext, /\b(korepetycje|lekcja|kurs online|kurs|certyfikat|szkolenie|studia|uczelnia)\b/i)) {
    if (has(combinedContext, /\b(udemy|coursera|online|kurs online)\b/i)) return resolve(CATEGORY.EDUCATION, SUB.kursyOnline, categoriesArray);
    if (has(combinedContext, /\b(angielski|hiszpanski|niemiecki|francuski|jezyk)\b/i)) return resolve(CATEGORY.EDUCATION, SUB.jezyki, categoriesArray);
    if (has(combinedContext, /\b(korepetycje|tutor)\b/i)) return resolve(CATEGORY.EDUCATION, SUB.korepetycje, categoriesArray);
    return resolve(CATEGORY.EDUCATION, SUB.szkola, categoriesArray);
  }
  if (has(combinedContext, /\b(podrecznik|zeszyt cwiczen|atlas szkolny|lektura)\b/i)) return resolve(CATEGORY.EDUCATION, SUB.podreczniki, categoriesArray);

  return null;
}
