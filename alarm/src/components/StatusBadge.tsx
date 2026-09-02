import type { AlarmStatus } from "../game/types";

const COPY: Record<AlarmStatus, { label: string; sub: string; cls: string }> = {
  OFF: {
    label: "○ OFF",
    sub: "Nothing terrible is happening. Yet.",
    cls: "border-white/10 bg-white/5 text-white/70",
  },
  ARMED: {
    label: "🔴 ALARM ARMED",
    sub: "Sleep peacefully while you still can.",
    cls: "border-rose-400/40 bg-rose-500/15 text-rose-200 animate-[pulse-glow_1.6s_ease-in-out_infinite]",
  },
  RINGING: {
    label: "🚨 ALARM ACTIVE",
    sub: "CATCH ME IF YOU CAN",
    cls: "border-red-400/60 bg-red-600/25 text-red-100",
  },
  CHALLENGE: {
    label: "⚡ CHALLENGE",
    sub: "Brain on. Eyes open.",
    cls: "border-amber-300/50 bg-amber-500/15 text-amber-100",
  },
  DEFEATED: {
    label: "🏆 ALARM DEFEATED",
    sub: "You survived.",
    cls: "border-emerald-300/50 bg-emerald-500/15 text-emerald-100",
  },
};

export function StatusBadge({ status }: { status: AlarmStatus }) {
  const c = COPY[status];
  return (
    <div className={`rounded-2xl border px-4 py-3 text-center ${c.cls}`}>
      <div className="text-sm font-extrabold tracking-wider sm:text-base">{c.label}</div>
      <div className="mt-1 text-[11px] text-white/60">{c.sub}</div>
    </div>
  );
}
