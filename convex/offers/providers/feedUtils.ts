import type { Doc } from "../../_generated/dataModel";
import type { NormalizedOfferInput } from "../types";

export type FeedOfferRow = Record<string, string>;

export function parseCsv(text: string): FeedOfferRow[] {
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && next === '"') {
      current += '"';
      i += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === "," && !inQuotes) {
      row.push(current);
      current = "";
      continue;
    }
    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(current);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      current = "";
      continue;
    }
    current += char;
  }

  row.push(current);
  if (row.some((cell) => cell.trim())) rows.push(row);
  if (rows.length < 2) return [];

  const headers = rows[0].map((header) => header.trim());
  return rows.slice(1).map((cells) =>
    Object.fromEntries(headers.map((header, index) => [header, cells[index]?.trim() ?? ""]))
  );
}

export async function fetchCsvFeed(envName: string) {
  const url = process.env[envName];
  if (!url) return [];
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Feed request failed for ${envName}: ${response.status}`);
  }
  return parseCsv(await response.text());
}

function pick(row: FeedOfferRow, keys: string[]) {
  const lower = new Map(Object.entries(row).map(([key, value]) => [key.toLowerCase(), value]));
  for (const key of keys) {
    const value = lower.get(key.toLowerCase());
    if (value) return value;
  }
  return "";
}

function splitList(value: string) {
  return value
    .split(/[|;,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseMoneyToCents(value: string) {
  const normalized = value.replace(/\s/g, "").replace(",", ".");
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? Math.round(numeric * 100) : undefined;
}

function parseOptionalNumber(value: string) {
  const numeric = Number(value.replace(",", "."));
  return Number.isFinite(numeric) ? numeric : undefined;
}

export function normalizeFeedRow(args: {
  row: FeedOfferRow;
  source: Doc<"offer_sources">;
  fallbackProvider: string;
}): NormalizedOfferInput {
  const row = args.row;
  const externalId = pick(row, ["id", "program_id", "campaign_id", "offer_id", "external_id"]);
  const title = pick(row, ["title", "name", "campaign_name", "program_name"]);
  const merchantName = pick(row, ["merchant", "merchant_name", "advertiser", "advertiser_name", "program_name"]) || title;
  const affiliateUrl = pick(row, ["affiliate_url", "tracking_url", "deeplink", "url"]);
  const startsAt = Date.parse(pick(row, ["starts_at", "start_date", "valid_from"])) || Date.now();
  const expiresRaw = pick(row, ["expires_at", "end_date", "valid_to"]);
  const expiresAt = expiresRaw ? Date.parse(expiresRaw) : undefined;
  const commissionRate = parseOptionalNumber(pick(row, ["commission_rate", "commission", "cps"]));
  const commissionAmount = parseMoneyToCents(pick(row, ["commission_amount", "cpc", "flat_fee"]));

  return {
    sourceId: args.source._id,
    sourceType: args.source.sourceType as any,
    externalId: externalId || `${args.fallbackProvider}:${merchantName}:${title}`,
    title,
    merchantName,
    description: pick(row, ["description", "summary"]) || title,
    categoryKeys: splitList(pick(row, ["category", "categories", "vertical"])),
    segmentKeys: splitList(pick(row, ["segments", "segment_keys"])),
    countryCodes: splitList(pick(row, ["country", "countries", "country_codes"])).length
      ? splitList(pick(row, ["country", "countries", "country_codes"]))
      : ["PL"],
    currency: pick(row, ["currency"]) || "PLN",
    revenueModel: commissionRate !== undefined ? "cps" : commissionAmount !== undefined ? "cpc" : "flat",
    commissionRate,
    commissionAmount: commissionAmount ?? 0,
    estimatedSavingsAmount: parseMoneyToCents(pick(row, ["estimated_savings", "savings_amount"])),
    estimatedSavingsPct: parseOptionalNumber(pick(row, ["estimated_savings_pct", "savings_pct"])),
    affiliateUrl,
    imageUrl: pick(row, ["image_url", "logo", "logo_url"]) || undefined,
    termsUrl: pick(row, ["terms_url", "terms"]) || undefined,
    startsAt,
    expiresAt: Number.isFinite(expiresAt) ? expiresAt : undefined,
    status: "active",
    weight: parseOptionalNumber(pick(row, ["weight", "priority"])) ?? 0,
    metadata: row,
  };
}
