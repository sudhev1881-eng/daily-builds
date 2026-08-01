import { createId } from "./format";
import { DEFAULT_WORKING_HOURS, ROLE_SALARIES } from "./presets";
import type { MeetingInput } from "./types";

const STORAGE_KEY = "agendatax:meeting:v1";

export function createDefaultMeeting(): MeetingInput {
  return {
    title: "Weekly product sync",
    durationMinutes: 45,
    frequency: "weekly",
    currency: "USD",
    workingHoursPerYear: DEFAULT_WORKING_HOURS,
    attendees: [
      {
        id: createId(),
        name: "Alex",
        role: "senior-engineer",
        annualSalary: ROLE_SALARIES["senior-engineer"].annualSalary,
      },
      {
        id: createId(),
        name: "Jordan",
        role: "pm",
        annualSalary: ROLE_SALARIES.pm.annualSalary,
      },
      {
        id: createId(),
        name: "Sam",
        role: "designer",
        annualSalary: ROLE_SALARIES.designer.annualSalary,
      },
      {
        id: createId(),
        name: "Riley",
        role: "manager",
        annualSalary: ROLE_SALARIES.manager.annualSalary,
      },
    ],
  };
}

export function loadMeeting(): MeetingInput | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MeetingInput;
    if (!parsed?.attendees || !Array.isArray(parsed.attendees)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveMeeting(meeting: MeetingInput): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(meeting));
  } catch {
    // Quota or private mode — ignore persistence failures.
  }
}

export function clearMeeting(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}
