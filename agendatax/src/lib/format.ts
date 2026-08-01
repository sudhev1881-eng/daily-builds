import { CURRENCY_META } from "./presets";
import type { CurrencyCode } from "./types";

export function formatMoney(
  amount: number,
  currency: CurrencyCode,
  options?: { compact?: boolean },
): string {
  const meta = CURRENCY_META[currency];
  try {
    return new Intl.NumberFormat(meta.locale, {
      style: "currency",
      currency,
      notation: options?.compact ? "compact" : "standard",
      maximumFractionDigits: options?.compact ? 1 : amount >= 1000 ? 0 : 2,
    }).format(Number.isFinite(amount) ? amount : 0);
  } catch {
    return `${meta.symbol}${Math.round(amount).toLocaleString()}`;
  }
}

export function formatHours(hours: number): string {
  if (!Number.isFinite(hours)) return "0h";
  if (hours >= 100) return `${Math.round(hours).toLocaleString()}h`;
  return `${hours.toFixed(hours >= 10 ? 0 : 1)}h`;
}

export function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
