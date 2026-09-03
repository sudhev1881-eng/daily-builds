import { useRef } from "react";
import { alarmAudio } from "../audio/AlarmAudio";
import { pad } from "../hooks/useNow";

interface Props {
  hour: number;
  minute: number;
  onHour: (h: number) => void;
  onMinute: (m: number) => void;
  disabled?: boolean;
}

function Wheel({
  value,
  max,
  onChange,
  label,
  disabled,
}: {
  value: number;
  max: number;
  onChange: (n: number) => void;
  label: string;
  disabled?: boolean;
}) {
  const start = useRef<{ y: number; v: number } | null>(null);
  const last = useRef(value);

  const bump = (dir: number) => {
    if (disabled) return;
    onChange((value + dir + max) % max);
    alarmAudio.tap();
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        className="interactive-btn rounded-full bg-white/5 px-3 py-1 text-rose-200"
        onClick={() => bump(1)}
        disabled={disabled}
        aria-label={`Increase ${label}`}
      >
        ▲
      </button>
      <div
        className="clock-font w-24 cursor-ns-resize select-none rounded-2xl border border-white/10 bg-black/40 py-5 text-center text-5xl font-bold shadow-[inset_0_0_24px_rgba(255,59,107,0.12)] transition-[transform,box-shadow] duration-150 sm:w-28 sm:text-6xl"
        role="slider"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max - 1}
        aria-valuenow={value}
        onPointerDown={(e) => {
          if (disabled) return;
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          start.current = { y: e.clientY, v: value };
          last.current = value;
        }}
        onPointerMove={(e) => {
          if (!start.current) return;
          const dy = start.current.y - e.clientY;
          const steps = Math.round(dy / 16);
          const next = (start.current.v + steps + max * 8) % max;
          onChange(next);
          if (next !== last.current) {
            last.current = next;
            alarmAudio.tap();
          }
        }}
        onPointerUp={() => {
          start.current = null;
        }}
      >
        {pad(value)}
      </div>
      <button
        type="button"
        className="interactive-btn rounded-full bg-white/5 px-3 py-1 text-rose-200"
        onClick={() => bump(-1)}
        disabled={disabled}
        aria-label={`Decrease ${label}`}
      >
        ▼
      </button>
      <span className="text-[10px] uppercase tracking-[0.3em] text-white/40">{label}</span>
    </div>
  );
}

export function TimeSelector({ hour, minute, onHour, onMinute, disabled }: Props) {
  return (
    <div className="flex items-center justify-center gap-4">
      <Wheel value={hour} max={24} onChange={onHour} label="hour" disabled={disabled} />
      <span className="clock-font mb-6 text-4xl text-rose-300/70">:</span>
      <Wheel value={minute} max={60} onChange={onMinute} label="min" disabled={disabled} />
    </div>
  );
}
