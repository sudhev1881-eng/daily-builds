"use client";

import {
  startTransition,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { AttendeeEditor } from "@/components/AttendeeEditor";
import { CostSummary } from "@/components/CostSummary";
import { calculateCosts, compareShorterMeeting } from "@/lib/calculate";
import { createId, formatMoney } from "@/lib/format";
import {
  CURRENCY_META,
  FREQUENCY_META,
  ROLE_SALARIES,
} from "@/lib/presets";
import { buildShareUrl, decodeMeeting } from "@/lib/share";
import {
  clearMeeting,
  createDefaultMeeting,
  loadMeeting,
  saveMeeting,
} from "@/lib/storage";
import type {
  CurrencyCode,
  Frequency,
  MeetingInput,
} from "@/lib/types";

type StatusMessage = { type: "success" | "error" | "info"; text: string } | null;

function readBootMeeting(): { meeting: MeetingInput; status: StatusMessage } {
  if (typeof window === "undefined") {
    return { meeting: createDefaultMeeting(), status: null };
  }

  const hash = window.location.hash;
  if (hash.startsWith("#m=")) {
    const decoded = decodeMeeting(hash.slice(3));
    if (decoded) {
      return {
        meeting: decoded,
        status: {
          type: "info",
          text: "Loaded shared meeting scenario from the link.",
        },
      };
    }
    return {
      meeting: loadMeeting() ?? createDefaultMeeting(),
      status: {
        type: "error",
        text: "That share link looks invalid. Loaded your last saved scenario instead.",
      },
    };
  }

  return {
    meeting: loadMeeting() ?? createDefaultMeeting(),
    status: null,
  };
}

function subscribeToHash(onStoreChange: () => void) {
  window.addEventListener("hashchange", onStoreChange);
  return () => window.removeEventListener("hashchange", onStoreChange);
}

function getClientBootKey() {
  return typeof window === "undefined"
    ? "server"
    : `${window.location.hash}::${window.localStorage.getItem("agendatax:meeting:v1") ? "saved" : "fresh"}`;
}

export function CalculatorApp() {
  const bootKey = useSyncExternalStore(
    subscribeToHash,
    getClientBootKey,
    () => "server",
  );
  const hydrated = bootKey !== "server";

  const [meeting, setMeeting] = useState<MeetingInput>(createDefaultMeeting);
  const [status, setStatus] = useState<StatusMessage>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [calcTick, setCalcTick] = useState(0);
  const [bootApplied, setBootApplied] = useState("server");

  if (hydrated && bootApplied !== bootKey && bootApplied === "server") {
    const boot = readBootMeeting();
    setMeeting(boot.meeting);
    setStatus(boot.status);
    setBootApplied(bootKey);
  }

  useEffect(() => {
    if (!hydrated) return;
    const timer = window.setTimeout(() => saveMeeting(meeting), 250);
    return () => window.clearTimeout(timer);
  }, [meeting, hydrated]);

  const costs = useMemo(() => calculateCosts(meeting), [meeting]);
  const comparison = useMemo(
    () => compareShorterMeeting(meeting, meeting.durationMinutes - 15),
    [meeting],
  );

  const isCalculating = calcTick > 0;

  const updateMeeting = (patch: Partial<MeetingInput>) => {
    startTransition(() => {
      setMeeting((current) => ({ ...current, ...patch }));
      setCalcTick((tick) => tick + 1);
    });
    window.setTimeout(() => {
      setCalcTick((tick) => Math.max(0, tick - 1));
    }, 280);
  };

  const addAttendee = () => {
    updateMeeting({
      attendees: [
        ...meeting.attendees,
        {
          id: createId(),
          name: "",
          role: "engineer",
          annualSalary: ROLE_SALARIES.engineer.annualSalary,
        },
      ],
    });
  };

  const handleShare = async () => {
    try {
      const url = buildShareUrl(meeting);
      await navigator.clipboard.writeText(url);
      setStatus({ type: "success", text: "Share link copied to clipboard." });
    } catch {
      setStatus({
        type: "error",
        text: "Could not copy the link. Check clipboard permissions.",
      });
    }
  };

  const handleExport = async () => {
    if (meeting.attendees.length === 0) {
      setStatus({
        type: "error",
        text: "Add at least one attendee before exporting a report.",
      });
      return;
    }

    setReportLoading(true);
    setStatus({ type: "info", text: "Generating Markdown report…" });

    try {
      const response = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(meeting),
      });
      const data = (await response.json()) as {
        markdown?: string;
        error?: string;
      };

      if (!response.ok || !data.markdown) {
        throw new Error(data.error || "Export failed");
      }

      const blob = new Blob([data.markdown], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${(meeting.title || "meeting")
        .replace(/\s+/g, "-")
        .toLowerCase()}-agendatax.md`;
      anchor.click();
      URL.revokeObjectURL(url);
      setStatus({ type: "success", text: "Markdown report downloaded." });
    } catch (error) {
      setStatus({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Could not export report. Please try again.",
      });
    } finally {
      setReportLoading(false);
    }
  };

  const handleReset = () => {
    clearMeeting();
    setMeeting(createDefaultMeeting());
    setCalcTick((tick) => tick + 1);
    window.setTimeout(() => {
      setCalcTick((tick) => Math.max(0, tick - 1));
    }, 280);
    if (window.location.hash) {
      window.history.replaceState(null, "", window.location.pathname);
    }
    setStatus({ type: "info", text: "Reset to the sample weekly sync." });
  };

  const isEmpty = meeting.attendees.length === 0;

  return (
    <div className="calculator" id="calculator">
      {!hydrated ? (
        <div className="panel loading-panel" role="status" aria-live="polite">
          <div className="skeleton-block" />
          <div className="skeleton-block short" />
          <p className="muted">Loading your scenario…</p>
        </div>
      ) : (
        <>
          <section className="panel form-panel" aria-label="Meeting inputs">
            <header className="panel-header">
              <div>
                <p className="eyebrow">Meeting setup</p>
                <h2>Price the invite</h2>
              </div>
              <div className="header-actions">
                <button type="button" className="btn btn-ghost" onClick={handleReset}>
                  Reset
                </button>
                <button type="button" className="btn btn-secondary" onClick={handleShare}>
                  Copy share link
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleExport}
                  disabled={reportLoading}
                >
                  {reportLoading ? "Exporting…" : "Export report"}
                </button>
              </div>
            </header>

            {status && (
              <p
                className={`status-banner status-${status.type}`}
                role="status"
                aria-live="polite"
              >
                {status.text}
              </p>
            )}

            <div className="form-grid">
              <label className="field span-2">
                <span>Meeting title</span>
                <input
                  type="text"
                  value={meeting.title}
                  onChange={(e) => updateMeeting({ title: e.target.value })}
                  placeholder="e.g. Weekly product sync"
                />
              </label>

              <label className="field">
                <span>Duration (minutes)</span>
                <input
                  type="number"
                  min={5}
                  max={480}
                  step={5}
                  value={meeting.durationMinutes}
                  onChange={(e) =>
                    updateMeeting({
                      durationMinutes: Number(e.target.value) || 0,
                    })
                  }
                />
              </label>

              <label className="field">
                <span>Frequency</span>
                <select
                  value={meeting.frequency}
                  onChange={(e) =>
                    updateMeeting({ frequency: e.target.value as Frequency })
                  }
                >
                  {(Object.keys(FREQUENCY_META) as Frequency[]).map((key) => (
                    <option key={key} value={key}>
                      {FREQUENCY_META[key].label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Currency</span>
                <select
                  value={meeting.currency}
                  onChange={(e) =>
                    updateMeeting({ currency: e.target.value as CurrencyCode })
                  }
                >
                  {(Object.keys(CURRENCY_META) as CurrencyCode[]).map((code) => (
                    <option key={code} value={code}>
                      {code} — {CURRENCY_META[code].label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Working hours / year</span>
                <input
                  type="number"
                  min={1000}
                  max={4000}
                  step={40}
                  value={meeting.workingHoursPerYear}
                  onChange={(e) =>
                    updateMeeting({
                      workingHoursPerYear: Number(e.target.value) || 2080,
                    })
                  }
                />
              </label>
            </div>

            <div className="attendees-block">
              <div className="attendees-heading">
                <h3>Attendees</h3>
                <p className="muted">
                  Salaries stay in your browser. Presets are editable estimates.
                </p>
              </div>
              <AttendeeEditor
                attendees={meeting.attendees}
                onChange={(attendees) => updateMeeting({ attendees })}
                onAdd={addAttendee}
              />
            </div>

            <p className="fine-print">
              Rough math using annual salary ÷ working hours. Not payroll advice —
              a decision aid for calendar hygiene.
              {meeting.attendees.length > 0 && (
                <>
                  {" "}
                  Combined loaded rate:{" "}
                  <strong>
                    {formatMoney(costs.hourlyRateTotal, meeting.currency)}/hr
                  </strong>
                  .
                </>
              )}
            </p>
          </section>

          <CostSummary
            costs={costs}
            currency={meeting.currency}
            yearlySavings={comparison.yearlySavings}
            isEmpty={isEmpty}
            isCalculating={isCalculating}
          />
        </>
      )}
    </div>
  );
}
