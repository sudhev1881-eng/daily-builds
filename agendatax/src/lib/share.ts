import type { MeetingInput, SharePayload } from "./types";

function toBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string): string {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  const binary = atob(padded + pad);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function encodeMeeting(meeting: MeetingInput): string {
  const payload: SharePayload = { v: 1, meeting };
  return toBase64Url(JSON.stringify(payload));
}

export function decodeMeeting(encoded: string): MeetingInput | null {
  try {
    const parsed = JSON.parse(fromBase64Url(encoded)) as SharePayload;
    if (parsed?.v !== 1 || !parsed.meeting || !Array.isArray(parsed.meeting.attendees)) {
      return null;
    }
    return parsed.meeting;
  } catch {
    return null;
  }
}

export function buildShareUrl(meeting: MeetingInput, origin?: string): string {
  const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/$/, "");
  const base =
    origin ??
    (typeof window !== "undefined"
      ? `${window.location.origin}${basePath}`
      : `http://localhost:3000${basePath}`);
  return `${base}/#m=${encodeMeeting(meeting)}`;
}

export function meetingToMarkdown(
  meeting: MeetingInput,
  costs: {
    costPerMeeting: number;
    weeklyCost: number;
    yearlyCost: number;
    personHoursPerYear: number;
    recommendation: string;
  },
  formatMoney: (n: number) => string,
): string {
  const lines = [
    `# AgendaTax Report: ${meeting.title || "Untitled meeting"}`,
    "",
    `- Duration: ${meeting.durationMinutes} minutes`,
    `- Frequency: ${meeting.frequency}`,
    `- Attendees: ${meeting.attendees.length}`,
    "",
    "## Cost",
    `- Per meeting: ${formatMoney(costs.costPerMeeting)}`,
    `- Weekly: ${formatMoney(costs.weeklyCost)}`,
    `- Yearly: ${formatMoney(costs.yearlyCost)}`,
    `- Person-hours / year: ${Math.round(costs.personHoursPerYear)}`,
    "",
    "## Recommendation",
    costs.recommendation,
    "",
    "## Attendees",
    ...meeting.attendees.map(
      (a) => `- ${a.name || "Attendee"} — $${a.annualSalary.toLocaleString()}/yr`,
    ),
    "",
    "_Generated with AgendaTax — privacy-first, runs in your browser._",
  ];
  return lines.join("\n");
}
