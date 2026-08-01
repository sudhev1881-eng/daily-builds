import { NextResponse } from "next/server";
import { calculateCosts } from "@/lib/calculate";
import { formatMoney } from "@/lib/format";
import { meetingToMarkdown } from "@/lib/share";
import type { MeetingInput } from "@/lib/types";

export const runtime = "nodejs";

function isMeetingInput(value: unknown): value is MeetingInput {
  if (!value || typeof value !== "object") return false;
  const m = value as MeetingInput;
  return (
    typeof m.title === "string" &&
    typeof m.durationMinutes === "number" &&
    typeof m.frequency === "string" &&
    typeof m.currency === "string" &&
    Array.isArray(m.attendees)
  );
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!isMeetingInput(body)) {
      return NextResponse.json(
        { error: "Invalid meeting payload. Include title, duration, frequency, currency, and attendees." },
        { status: 400 },
      );
    }

    if (body.attendees.length === 0) {
      return NextResponse.json(
        { error: "Add at least one attendee before generating a report." },
        { status: 400 },
      );
    }

    const costs = calculateCosts(body);
    const markdown = meetingToMarkdown(body, costs, (n) =>
      formatMoney(n, body.currency),
    );

    return NextResponse.json({
      markdown,
      costs: {
        costPerMeeting: costs.costPerMeeting,
        weeklyCost: costs.weeklyCost,
        yearlyCost: costs.yearlyCost,
        severity: costs.severity,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Could not generate report. Please try again." },
      { status: 500 },
    );
  }
}
