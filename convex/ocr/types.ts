"use node";

export interface ProcessedReceiptItem {
  description: string;
  originalRawDescription?: string;
  amount: string;
  categoryId: string | null;
  subcategoryId: string | null;
  fromMapping?: boolean;
  receiptIndex: number;
  receiptLabel?: string;
  sourceImageIndex?: number | null;
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

export interface ProcessReceiptResult {
  items: ProcessedReceiptItem[];
  rawText: string;
  totalAmount: string;
  payableAmount?: string;
  depositTotal?: string;
  modelUsed: string;
  receiptCount: number;
  receiptSummaries: ReceiptSummary[];
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
