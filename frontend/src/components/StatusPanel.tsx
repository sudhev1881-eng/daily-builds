import type { RoomStatus, TrackedPerson } from "../types/sensor";
import { personColor, personLabel } from "../types/sensor";

interface StatusPanelProps {
  roomStatus: RoomStatus;
  presenceProbability: number;
  movementProbability: number;
  personCount: number;
  people: TrackedPerson[];
  timestamp: string | null;
  connected: boolean;
  positionError: number | null;
  accuracyRadius: number;
  calibrationQuality: number | null;
  simulationMode: boolean;
}

const statusConfig: Record<
  string,
  { color: string; bg: string; glow: string }
> = {
  BOOTING: { color: "text-sky-400", bg: "bg-sky-500/10", glow: "" },
  "BASELINE ESTABLISHED": {
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    glow: "",
  },
  "ROOM EMPTY": { color: "text-slate-400", bg: "bg-slate-500/10", glow: "" },
  "OCCUPIED — STATIONARY": {
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    glow: "status-glow-person",
  },
  "HUMAN MOVING": {
    color: "text-sky-400",
    bg: "bg-sky-500/10",
    glow: "status-glow-movement",
  },
  "ENVIRONMENTAL ACTIVITY": {
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    glow: "",
  },
  "ENVIRONMENTAL CHANGE DETECTED": {
    color: "text-amber-300",
    bg: "bg-amber-500/10",
    glow: "",
  },
  "NOISE / IGNORE": {
    color: "text-slate-500",
    bg: "bg-slate-500/5",
    glow: "",
  },
};

export function StatusPanel({
  roomStatus,
  presenceProbability,
  movementProbability,
  personCount,
  people,
  timestamp,
  connected,
  positionError,
  accuracyRadius,
  calibrationQuality,
  simulationMode,
}: StatusPanelProps) {
  const cfg = statusConfig[roomStatus] ?? statusConfig["ROOM EMPTY"];

  return (
    <div className={`glass-panel p-4 ${cfg.glow}`}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-mono text-xs tracking-wider text-slate-500 uppercase">
          Room Status
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

      <div className={`mb-4 rounded-lg px-4 py-3 text-center ${cfg.bg}`}>
        <p className={`font-mono text-lg font-semibold ${cfg.color}`}>
          {roomStatus}
        </p>
        {personCount > 0 && (
          <p className="mt-1 font-mono text-[11px] text-slate-400">
            {personCount} {personCount === 1 ? "person" : "people"} detected
          </p>
        )}
      </div>

      {people.length > 0 && (
        <div className="mb-4 space-y-1">
          {people.map((p) => {
            const color = personColor(p.id, p.is_user);
            return (
              <div
                key={p.id}
                className="flex items-center justify-between rounded bg-slate-800/40 px-2.5 py-1.5"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: p.moving ? color.main : color.still }}
                  />
                  <span
                    className={`font-mono text-[11px] ${p.is_user ? "font-semibold text-pink-300" : "text-slate-300"}`}
                  >
                    {personLabel(p)}
                  </span>
                </div>
                <span className="font-mono text-[10px] text-slate-500">
                  {p.moving
                    ? `moving · ${p.velocity.toFixed(1)} m/s`
                    : "stationary"}
                </span>
              </div>
            );
          })}
        </div>
      )}

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

      {calibrationQuality !== null && (
        <p className="mt-3 font-mono text-[10px] text-slate-500">
          Baseline quality:{" "}
          <span className={calibrationQuality >= 0.7 ? "text-emerald-400" : "text-amber-400"}>
            {(calibrationQuality * 100).toFixed(0)}%
          </span>
        </p>
      )}

      {timestamp && (
        <p className="mt-1 font-mono text-[10px] text-slate-600">
          Last update: {new Date(timestamp).toLocaleTimeString()}
        </p>
      )}

      {simulationMode && positionError !== null && (
        <div className="mt-2 rounded-lg bg-slate-800/50 px-3 py-2">
          <p className="font-mono text-[10px] text-slate-500">
            Position error: <span className="text-sky-400">{positionError.toFixed(2)}m</span>
          </p>
          <p className="font-mono text-[10px] text-slate-500">
            Accuracy radius: <span className="text-sky-400">±{accuracyRadius.toFixed(1)}m</span>
          </p>
        </div>
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
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${Math.min(100, value)}%` }}
        />
      </div>
    </div>
  );
}
