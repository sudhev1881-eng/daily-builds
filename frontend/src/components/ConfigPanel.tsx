import { useState } from "react";
import type { RoomConfig } from "../types/sensor";

interface ConfigPanelProps {
  room: RoomConfig;
  onUpdate: (config: RoomConfig) => void;
}

export function ConfigPanel({ room, onUpdate }: ConfigPanelProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<RoomConfig>(room);

  const apply = () => {
    onUpdate(draft);
    setOpen(false);
  };

  const reset = () => {
    setDraft(room);
  };

  const updateField = (field: string, value: number) => {
    setDraft((prev) => {
      if (field === "width" || field === "height") {
        return { ...prev, [field]: value };
      }
      if (field === "router.x") {
        return { ...prev, router: { ...prev.router, x: value } };
      }
      if (field === "router.y") {
        return { ...prev, router: { ...prev.router, y: value } };
      }
      if (field === "receiver.x") {
        return { ...prev, receiver: { ...prev.receiver, x: value } };
      }
      if (field === "receiver.y") {
        return { ...prev, receiver: { ...prev.receiver, y: value } };
      }
      return prev;
    });
  };

  return (
    <div className="glass-panel">
      <button
        onClick={() => {
          setOpen(!open);
          setDraft(room);
        }}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="font-mono text-xs tracking-wider text-slate-500 uppercase">
          Room & Sensor Config
        </span>
        <span className="text-slate-500">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="space-y-3 border-t border-slate-800/50 px-4 pt-3 pb-4">
          <div className="grid grid-cols-2 gap-3">
            <NumberInput
              label="Width (m)"
              value={draft.width}
              min={2}
              max={30}
              step={0.5}
              onChange={(v) => updateField("width", v)}
            />
            <NumberInput
              label="Height (m)"
              value={draft.height}
              min={2}
              max={30}
              step={0.5}
              onChange={(v) => updateField("height", v)}
            />
          </div>

          <p className="font-mono text-[10px] text-slate-600 uppercase">
            Router Position
          </p>
          <div className="grid grid-cols-2 gap-3">
            <NumberInput
              label="X (m)"
              value={draft.router.x}
              min={0}
              max={draft.width}
              step={0.1}
              onChange={(v) => updateField("router.x", v)}
            />
            <NumberInput
              label="Y (m)"
              value={draft.router.y}
              min={0}
              max={draft.height}
              step={0.1}
              onChange={(v) => updateField("router.y", v)}
            />
          </div>

          <p className="font-mono text-[10px] text-slate-600 uppercase">
            Receiver Position
          </p>
          <div className="grid grid-cols-2 gap-3">
            <NumberInput
              label="X (m)"
              value={draft.receiver.x}
              min={0}
              max={draft.width}
              step={0.1}
              onChange={(v) => updateField("receiver.x", v)}
            />
            <NumberInput
              label="Y (m)"
              value={draft.receiver.y}
              min={0}
              max={draft.height}
              step={0.1}
              onChange={(v) => updateField("receiver.y", v)}
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={apply}
              className="flex-1 rounded-lg bg-sky-600/20 px-3 py-1.5 font-mono text-xs text-sky-300 transition hover:bg-sky-600/30"
            >
              Apply
            </button>
            <button
              onClick={reset}
              className="rounded-lg bg-slate-800/50 px-3 py-1.5 font-mono text-xs text-slate-400 transition hover:bg-slate-800"
            >
              Reset
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function NumberInput({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="mb-1 block font-mono text-[10px] text-slate-500">
        {label}
      </label>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="w-full rounded-lg border border-slate-700/50 bg-slate-900/50 px-2 py-1.5 font-mono text-xs text-slate-300 outline-none focus:border-sky-500/50"
      />
    </div>
  );
}
