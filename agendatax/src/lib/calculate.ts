import { DEFAULT_WORKING_HOURS, FREQUENCY_META } from "./presets";
import type { Attendee, CostBreakdown, MeetingInput } from "./types";

function clampPositive(value: number, fallback = 0): number {
  if (!Number.isFinite(value) || value < 0) return fallback;
  return value;
}

export function hourlyRate(
  annualSalary: number,
  workingHoursPerYear = DEFAULT_WORKING_HOURS,
): number {
  const hours = clampPositive(workingHoursPerYear, DEFAULT_WORKING_HOURS) || DEFAULT_WORKING_HOURS;
  return clampPositive(annualSalary) / hours;
}

export function totalHourlyRate(
  attendees: Attendee[],
  workingHoursPerYear = DEFAULT_WORKING_HOURS,
): number {
  return attendees.reduce(
    (sum, attendee) => sum + hourlyRate(attendee.annualSalary, workingHoursPerYear),
    0,
  );
}

function severityForYearlyCost(yearlyCost: number): CostBreakdown["severity"] {
  if (yearlyCost >= 100000) return "extreme";
  if (yearlyCost >= 40000) return "high";
  if (yearlyCost >= 12000) return "moderate";
  return "low";
}

function recommendationFor(
  severity: CostBreakdown["severity"],
  durationMinutes: number,
  attendeeCount: number,
): string {
  switch (severity) {
    case "extreme":
      return "This recurring meeting costs six figures a year. Convert it to async updates, cut the invite list, or kill it unless it directly drives revenue.";
    case "high":
      return attendeeCount > 6
        ? "High cost with a large invite list. Keep only decision-makers live; share notes asynchronously for everyone else."
        : "High annual cost. Shorten the agenda, reduce frequency, or replace status rounds with a written update.";
    case "moderate":
      return durationMinutes > 30
        ? "Moderate tax on the calendar. Try a 15–25 minute default and a written pre-read."
        : "Reasonable cost if outcomes are clear. Keep a tight agenda and end early when possible.";
    default:
      return "Low calendar tax. Still worth a clear owner, agenda, and decision log so time stays intentional.";
  }
}

export function calculateCosts(input: MeetingInput): CostBreakdown {
  const durationMinutes = clampPositive(input.durationMinutes);
  const workingHours = clampPositive(
    input.workingHoursPerYear,
    DEFAULT_WORKING_HOURS,
  ) || DEFAULT_WORKING_HOURS;
  const attendees = input.attendees.filter((a) => a.annualSalary > 0);
  const freq = FREQUENCY_META[input.frequency];

  const hourlyRateTotal = totalHourlyRate(attendees, workingHours);
  const costPerMeeting = hourlyRateTotal * (durationMinutes / 60);
  const meetingsPerYear = freq.meetingsPerYear;
  const yearlyCost = costPerMeeting * meetingsPerYear;
  const weeklyCost = costPerMeeting * freq.perWeekFactor;
  const monthlyCost = yearlyCost / 12;
  const personHoursPerYear =
    attendees.length * (durationMinutes / 60) * meetingsPerYear;
  const severity = severityForYearlyCost(yearlyCost);

  return {
    hourlyRateTotal,
    costPerMeeting,
    meetingsPerYear,
    weeklyCost,
    monthlyCost,
    yearlyCost,
    personHoursPerYear,
    severity,
    recommendation: recommendationFor(
      severity,
      durationMinutes,
      attendees.length,
    ),
  };
}

export function compareShorterMeeting(
  input: MeetingInput,
  shorterMinutes: number,
): { current: CostBreakdown; shorter: CostBreakdown; yearlySavings: number } {
  const current = calculateCosts(input);
  const shorter = calculateCosts({
    ...input,
    durationMinutes: Math.max(5, shorterMinutes),
  });
  return {
    current,
    shorter,
    yearlySavings: Math.max(0, current.yearlyCost - shorter.yearlyCost),
  };
}
