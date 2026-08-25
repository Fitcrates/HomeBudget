"use node";

/**
 * Market pack — cala wiedza o konkretnym rynku w jednym miejscu.
 *
 * Pipeline OCR nie wie nic o zadnym kraju: dostaje pakiet wybrany po
 * `household.country` i pracuje na nim. Dodanie rynku to dodanie pliku obok,
 * nie zmiana w parserze. Brak pakietu dla kraju = pakiet generyczny, czyli
 * pipeline nadal dziala, tylko z mniejsza trafnoscia.
 */

export interface MarketLexicon {
  /** Linia rabatu/promocji — trafienie robi z pozycji kwote ujemna. */
  discount: RegExp;
  /**
   * Rabat zapisany w jednej linii razem z kwota ("OPUST mleko -2,00").
   * Grupa 1 = opis, grupa 2 = kwota.
   */
  discountLine: RegExp;
  /** Kaucja za opakowanie — trafienie wyklucza linie z pozycji paragonu. */
  deposit: RegExp;
  /** Linia niebedaca produktem (sumy, podatki, forma platnosci, stopka). */
  technical: RegExp;
  /**
   * Slowa pomijane przy dopasowywaniu rabatu do produktu — same w sobie nie
   * identyfikuja towaru.
   */
  stopWords: string[];
}

export interface MarketPack {
  /** ISO 3166-1 alpha-2 albo "XX" dla pakietu generycznego. */
  country: string;
  /** Waluta, ktorej sie spodziewamy, gdy paragon jej nie deklaruje. */
  defaultCurrency: string;
  lexicon: MarketLexicon;
  /**
   * Linie doklejane do promptu ekstrakcji. Tu mieszka wiedza o lokalnych
   * sieciach i o tym, jak drukuja sumy — rdzen promptu zostaje neutralny.
   */
  promptHints: string[];
  /**
   * Instrukcje merytoryczne promptu audytowego. Osobne od `promptHints`, bo
   * audyt to drugi, rygorystyczny odczyt i mowi modelowi co innego.
   */
  auditLines: string[];
}
