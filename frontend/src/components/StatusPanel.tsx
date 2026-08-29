import type { DetectionStatus } from "../types/sensor";

interface StatusPanelProps {
  status: DetectionStatus;
  presenceProbability: number;
  movementProbability: number;
  timestamp: string | null;
  connected: boolean;
}

const statusConfig: Record<
  DetectionStatus,
  { color: string; bg: string; glow: string }
> = {
  "No Person Detected": {
    color: "text-slate-400",
    bg: "bg-slate-500/10",
    glow: "",
  },
  "Person Detected": {
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    glow: "status-glow-person",
  },
  "Movement Detected": {
    color: "text-sky-400",
    bg: "bg-sky-500/10",
    glow: "status-glow-movement",
  },
};

export function StatusPanel({
  status,
  presenceProbability,
  movementProbability,
  timestamp,
  connected,
}: StatusPanelProps) {
  const cfg = statusConfig[status];

  return (
    <div className={`glass-panel p-4 ${cfg.glow}`}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-mono text-xs tracking-wider text-slate-500 uppercase">
          Detection Status
        </h3>
        <div className="flex items-center gap-1.5">
          <span
            className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-400" : "bg-red-400"}`}
          />
          <span className="font-mono text-[10px] text-slate-500">
            {connected ? "LIVE" : "OFFLINE"}
          </span>
        </div>
      </div>

      <div
        className={`mb-4 rounded-lg px-4 py-3 text-center ${cfg.bg}`}
      >
        <p className={`font-mono text-lg font-semibold ${cfg.color}`}>
          {status}
        </p>
      </div>

      <div className="space-y-2">
        <MetricBar
          label="Presence"
          value={presenceProbability * 100}
          color="bg-emerald-400"
        />
        <MetricBar
          label="Movement"
          value={movementProbability * 100}
          color="bg-sky-400"
        />
      </div>

      {timestamp && (
        <p className="mt-3 font-mono text-[10px] text-slate-600">
          Last update: {new Date(timestamp).toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}

function MetricBar({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div>
      <div className="mb-1 flex justify-between">
        <span className="font-mono text-[10px] text-slate-500">{label}</span>
        <span className="font-mono text-[10px] text-slate-400">
          {value.toFixed(0)}%
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
        <div
          className={`h-full rounded-full transition-all duration-300 ${color}`}
          style={{ width: `${Math.min(100, value)}%` }}
        />
      </div>
    </div>
  );
}
