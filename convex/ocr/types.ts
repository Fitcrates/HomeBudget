"use node";

export interface ProcessedReceiptItem {
  description: string;
  originalRawDescription?: string;
  amount: string;
  categoryId: string | null;
  subcategoryId: string | null;
  fromMapping?: boolean;
  categorySource?: "mapping" | "ai" | "heuristic" | "fallback" | "discount";
  receiptIndex: number;
  receiptLabel?: string;
  sourceImageIndex?: number | null;
  /** Kwota sprzed przeliczenia — zapisywana tylko gdy waluty sie roznily. */
  originalAmount?: string;
  originalCurrency?: string;
  exchangeRate?: number;
}

export interface ReceiptSummary {
  receiptIndex: number;
  receiptLabel: string;
  totalAmount: string;
  payableAmount?: string;
  depositTotal?: string;
  sourceImageIndex: number | null;
  itemsTotal?: string;
  difference?: string;
  mismatchType?: "ok" | "missing_items" | "missing_discounts" | "unknown";
}

export interface CurrencyContext {
  /** Waluta odczytana z paragonu (pusta = zalozono walute gospodarstwa). */
  receiptCurrency: string;
  targetCurrency: string;
  exchangeRate: number;
  exchangeRateDate: string;
  /** Kurs byl potrzebny, ale nie udalo sie go pobrac — kwoty zostaly w walucie paragonu. */
  conversionFailed: boolean;
}

export interface ProcessReceiptResult {
  items: ProcessedReceiptItem[];
  rawText: string;
  totalAmount: string;
  payableAmount?: string;
  depositTotal?: string;
  modelUsed: string;
  receiptCount: number;
  receiptSummaries: ReceiptSummary[];
  currency?: CurrencyContext;
}

export type AuditedLineCandidate = {
  item: ProcessedReceiptItem;
  receiptIndex: number;
  receiptLabel: string;
  sourceImageIndex: number | null;
};

export type CategoryResolution = {
  categoryId: string | null;
  subcategoryId: string | null;
};
