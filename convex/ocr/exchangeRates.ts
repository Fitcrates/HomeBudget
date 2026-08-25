"use node";

/**
 * Kursy walut dla pipeline'u OCR.
 *
 * Paragon bywa w innej walucie niz gospodarstwo (wakacje, zakupy zagraniczne),
 * wiec kwoty trzeba przeliczyc na walute gospodarstwa — a nie, jak wczesniej,
 * zawsze na PLN.
 *
 * Zrodlem jest tabela A NBP, ktora publikuje kursy `X -> PLN`. Kurs dowolnej
 * pary liczymy krzyzowo: `X -> Y = (X -> PLN) / (Y -> PLN)`. Dzieki temu nie
 * dokladamy drugiego dostawcy, a para bez PLN (np. EUR -> CZK) tez dziala.
 *
 * Nieudane pobranie zwraca `null`, nigdy kursu 1.0 — cichy kurs 1.0 zapisalby
 * kwoty w obcej walucie tak, jakby byly w walucie gospodarstwa.
 */

const EXCHANGE_RATE_TIMEOUT_MS = 2500;
const EXCHANGE_RATE_CACHE_TTL_MS = 60 * 60 * 1000;

export interface ExchangeRateResult {
  /** Ile jednostek waluty docelowej kosztuje jedna jednostka zrodlowej. */
  rate: number;
  /** Data kursu wg NBP (YYYY-MM-DD), pusta dla kursu tozsamosciowego. */
  date: string;
}

interface CachedLeg {
  rate: number;
  date: string;
  expiresAt: number;
}

const legCache = new Map<string, CachedLeg>();

/** Kurs `code -> PLN` z tabeli A NBP. */
async function fetchPlnLeg(code: string): Promise<{ rate: number; date: string } | null> {
  if (code === "PLN") return { rate: 1, date: "" };

  const cached = legCache.get(code);
  if (cached && cached.expiresAt > Date.now()) {
    return { rate: cached.rate, date: cached.date };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), EXCHANGE_RATE_TIMEOUT_MS);
  try {
    const response = await fetch(`https://api.nbp.pl/api/exchangerates/rates/a/${code}/?format=json`, {
      signal: controller.signal,
    });
    if (!response.ok) return null;

    const data = await response.json();
    const rate = Number(data?.rates?.[0]?.mid);
    const date = String(data?.rates?.[0]?.effectiveDate || "");
    if (!Number.isFinite(rate) || !(rate > 0)) return null;

    legCache.set(code, { rate, date, expiresAt: Date.now() + EXCHANGE_RATE_CACHE_TTL_MS });
    return { rate, date };
  } catch (error) {
    console.error(`[OCR] Exchange rate leg failed for ${code}`, error);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export function normalizeCurrencyCode(value: string | null | undefined): string {
  const code = (value ?? "").trim().toUpperCase();
  return /^[A-Z]{3}$/.test(code) ? code : "";
}

export async function fetchExchangeRate(
  fromCurrency: string,
  toCurrency: string
): Promise<ExchangeRateResult | null> {
  const from = normalizeCurrencyCode(fromCurrency);
  const to = normalizeCurrencyCode(toCurrency);

  // Brak deklaracji waluty na paragonie oznacza "zgodna z gospodarstwem" —
  // to najczestszy przypadek i nie ma powodu strzelac po kurs.
  if (!from || !to || from === to) return { rate: 1, date: "" };

  const [fromLeg, toLeg] = await Promise.all([fetchPlnLeg(from), fetchPlnLeg(to)]);
  if (!fromLeg || !toLeg || !(toLeg.rate > 0)) return null;

  const rate = fromLeg.rate / toLeg.rate;
  if (!Number.isFinite(rate) || !(rate > 0)) return null;

  return {
    rate,
    // Data z nogi obcej: dla pary z PLN druga noga daty nie ma.
    date: fromLeg.date || toLeg.date,
  };
}
