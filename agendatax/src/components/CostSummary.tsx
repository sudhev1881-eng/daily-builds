"use client";

import { AnimatedNumber } from "@/components/AnimatedNumber";
import { formatHours, formatMoney } from "@/lib/format";
import type { CostBreakdown, CurrencyCode } from "@/lib/types";

const SEVERITY_STYLES: Record<
  CostBreakdown["severity"],
  { label: string; className: string }
> = {
  low: { label: "Low tax", className: "severity-low" },
  moderate: { label: "Moderate tax", className: "severity-moderate" },
  high: { label: "High tax", className: "severity-high" },
  extreme: { label: "Extreme tax", className: "severity-extreme" },
};

interface CostSummaryProps {
  costs: CostBreakdown;
  currency: CurrencyCode;
  yearlySavings: number;
  isEmpty: boolean;
  isCalculating: boolean;
}

export function CostSummary({
  costs,
  currency,
  yearlySavings,
  isEmpty,
  isCalculating,
}: CostSummaryProps) {
  if (isEmpty) {
    return (
      <section
        className="panel results-panel empty-panel"
        aria-live="polite"
        aria-label="Cost results"
      >
        <p className="eyebrow">Results</p>
        <h2>No attendees yet</h2>
        <p className="muted">
          Add people to the invite list to see how much this recurring meeting
          costs your team each year.
        </p>
      </section>
    );
  }

  const severity = SEVERITY_STYLES[costs.severity];

  return (
    <section
      className={`panel results-panel ${isCalculating ? "is-calculating" : ""}`}
      aria-live="polite"
      aria-label="Cost results"
    >
      <div className="results-top">
        <p className="eyebrow">Annual meeting tax</p>
        <span className={`severity-badge ${severity.className}`}>
          {severity.label}
        </span>
      </div>

      <p className="hero-cost">
        <AnimatedNumber
          value={costs.yearlyCost}
          format={(n) => formatMoney(n, currency, { compact: n >= 10000 })}
        />
      </p>
      <p className="muted hero-cost-sub">per year for this recurring meeting</p>

      <dl className="stat-grid">
        <div>
          <dt>Per meeting</dt>
          <dd>
            <AnimatedNumber
              value={costs.costPerMeeting}
              format={(n) => formatMoney(n, currency)}
            />
          </dd>
        </div>
        <div>
          <dt>Weekly</dt>
          <dd>
            <AnimatedNumber
              value={costs.weeklyCost}
              format={(n) => formatMoney(n, currency)}
            />
          </dd>
        </div>
        <div>
          <dt>Monthly</dt>
          <dd>
            <AnimatedNumber
              value={costs.monthlyCost}
              format={(n) => formatMoney(n, currency)}
            />
          </dd>
        </div>
        <div>
          <dt>Person-hours / year</dt>
          <dd>
            <AnimatedNumber
              value={costs.personHoursPerYear}
              format={formatHours}
            />
          </dd>
        </div>
      </dl>

      {yearlySavings > 0 && (
        <p className="savings-callout">
          Cutting 15 minutes saves{" "}
          <strong>{formatMoney(yearlySavings, currency)}</strong> per year.
        </p>
      )}

      <div className="recommendation">
        <h3>Recommendation</h3>
        <p>{costs.recommendation}</p>
      </div>
    </section>
  );
}
