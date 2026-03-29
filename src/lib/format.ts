export function formatAmount(amountCents: number, currency: string): string {
  const value = amountCents / 100;
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: currency || "PLN",
    minimumFractionDigits: 2,
  }).format(value);
}

export function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(timestamp));
}
