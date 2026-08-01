export type CurrencyCode = "USD" | "EUR" | "GBP" | "INR" | "CAD" | "AUD";

export type Frequency =
  | "daily"
  | "weekly"
  | "biweekly"
  | "monthly"
  | "quarterly";

export type RolePreset =
  | "custom"
  | "engineer"
  | "senior-engineer"
  | "manager"
  | "director"
  | "executive"
  | "designer"
  | "pm"
  | "ops";

export interface Attendee {
  id: string;
  name: string;
  role: RolePreset;
  annualSalary: number;
}

export interface MeetingInput {
  title: string;
  durationMinutes: number;
  frequency: Frequency;
  currency: CurrencyCode;
  workingHoursPerYear: number;
  attendees: Attendee[];
}

export interface CostBreakdown {
  hourlyRateTotal: number;
  costPerMeeting: number;
  meetingsPerYear: number;
  weeklyCost: number;
  monthlyCost: number;
  yearlyCost: number;
  personHoursPerYear: number;
  severity: "low" | "moderate" | "high" | "extreme";
  recommendation: string;
}

export interface SharePayload {
  v: 1;
  meeting: MeetingInput;
}
