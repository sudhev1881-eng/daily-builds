import type { BubbleStyle } from "../game/types";

interface Props {
  text: string;
  x: number;
  y: number;
  styleKind: BubbleStyle;
}

export function RageBubble({ text, x, y, styleKind }: Props) {
  if (styleKind === "emoji") {
    return (
      <div
        className="pointer-events-none fixed z-30 text-4xl bait-float"
        style={{ left: x + 28, top: y - 48 }}
      >
        {text.slice(-2)}
      </div>
    );
  }

  if (styleKind === "toast") {
    return (
      <div
        className="bait-toast pointer-events-none fixed z-30 max-w-[240px] rounded-full bg-rose-500 px-4 py-2 text-sm font-bold text-white shadow-lg"
        style={{ left: x + 84, top: y - 64 }}
      >
        <span className="ml">{text}</span>
      </div>
    );
  }

  if (styleKind === "float") {
    return (
      <div
        className="bait-float pointer-events-none fixed z-30 max-w-[220px] text-center text-base font-bold text-amber-200"
        style={{ left: x, top: y - 40 }}
      >
        <span className="ml">{text}</span>
      </div>
    );
  }

  if (styleKind === "npc") {
    return (
      <div
        className="bait-npc pointer-events-none fixed z-30 max-w-[230px] rounded-xl border border-white/20 bg-zinc-900/90 px-3 py-2 text-sm text-white shadow-xl"
        style={{ left: x + 8, top: y - 72 }}
      >
        <p className="text-[9px] uppercase tracking-[0.25em] text-rose-300/80">NPC</p>
        <p className="ml mt-0.5">{text}</p>
      </div>
    );
  }

  return (
    <div
      className="speech-bubble pointer-events-none fixed z-30 max-w-[230px] rounded-2xl bg-white px-3 py-2 text-sm font-semibold text-zinc-900 shadow-xl"
      style={{ left: x + 16, top: y - 62 }}
    >
      <span className="ml">{text}</span>
    </div>
  );
}
