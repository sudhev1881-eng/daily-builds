import type { CurrencyCode, Frequency, RolePreset } from "./types";

export const ROLE_SALARIES: Record<
  Exclude<RolePreset, "custom">,
  { label: string; annualSalary: number }
> = {
  engineer: { label: "Software Engineer", annualSalary: 120000 },
  "senior-engineer": { label: "Senior Engineer", annualSalary: 165000 },
  manager: { label: "Engineering Manager", annualSalary: 185000 },
  director: { label: "Director", annualSalary: 230000 },
  executive: { label: "Executive / VP", annualSalary: 320000 },
  designer: { label: "Product Designer", annualSalary: 130000 },
  pm: { label: "Product Manager", annualSalary: 155000 },
  ops: { label: "Operations", annualSalary: 95000 },
};

export const FREQUENCY_META: Record<
  Frequency,
  { label: string; meetingsPerYear: number; perWeekFactor: number }
> = {
  daily: { label: "Daily", meetingsPerYear: 260, perWeekFactor: 5 },
  weekly: { label: "Weekly", meetingsPerYear: 52, perWeekFactor: 1 },
  biweekly: { label: "Every 2 weeks", meetingsPerYear: 26, perWeekFactor: 0.5 },
  monthly: { label: "Monthly", meetingsPerYear: 12, perWeekFactor: 12 / 52 },
  quarterly: { label: "Quarterly", meetingsPerYear: 4, perWeekFactor: 4 / 52 },
};

export const CURRENCY_META: Record<
  CurrencyCode,
  { label: string; locale: string; symbol: string }
> = {
  USD: { label: "US Dollar", locale: "en-US", symbol: "$" },
  EUR: { label: "Euro", locale: "de-DE", symbol: "€" },
  GBP: { label: "British Pound", locale: "en-GB", symbol: "£" },
  INR: { label: "Indian Rupee", locale: "en-IN", symbol: "₹" },
  CAD: { label: "Canadian Dollar", locale: "en-CA", symbol: "CA$" },
  AUD: { label: "Australian Dollar", locale: "en-AU", symbol: "A$" },
};

export const DEFAULT_WORKING_HOURS = 2080;
