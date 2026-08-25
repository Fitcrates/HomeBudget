/**
 * Wykrywanie locale przeglądarki dla nowo zakładanego gospodarstwa.
 *
 * Wynik jest tylko wartością domyślną — użytkownik może ją później zmienić,
 * a backend i tak waliduje oba pola. Nieznany język schodzi do polskiego,
 * czyli do zachowania sprzed wielorynkowości.
 */

const SUPPORTED_LANGUAGES = new Set(["pl", "en"]);

export interface DetectedLocale {
  language: string;
  country: string;
}

export function detectBrowserLocale(): DetectedLocale {
  if (typeof navigator === "undefined") {
    return { language: "pl", country: "PL" };
  }

  const tag = navigator.languages?.[0] || navigator.language || "pl-PL";
  const [rawLanguage, rawRegion] = tag.split("-");
  const requested = rawLanguage?.toLowerCase() ?? "";
  // Nieobsługiwany język schodzi do angielskiego, nie do polskiego: dla
  // przeglądarki ustawionej na niemiecki polskie etykiety są bezużyteczne,
  // a angielskie przynajmniej czytelne.
  const language = SUPPORTED_LANGUAGES.has(requested) ? requested : "en";

  const region = (rawRegion || "").toUpperCase();
  const country = /^[A-Z]{2}$/.test(region) ? region : language === "pl" ? "PL" : "GB";

  return { language, country };
}
