import type { RefObject } from "react";
import { formatMs } from "../hooks/useNow";
import type { PointerState } from "../hooks/usePointer";
import type { AlarmGame } from "../game/useAlarmGame";
import { ChaseLayer } from "./ChaseLayer";

export function RingingScreen({
  game,
  pointer,
}: {
  game: AlarmGame;
  pointer: RefObject<PointerState>;
}) {
  const beatAge = Math.max(0, 1 - (performance.now() - game.beat) / 320);

  return (
    <div className="relative z-10 min-h-dvh overflow-hidden">
      {game.screenFx === "pulse" || beatAge > 0.15 ? (
        <div key={game.beat} className="beat-veil" />
      ) : null}

      <div className="warning-stripes stripe-top pointer-events-none absolute inset-x-0 top-0 z-10 h-11 opacity-90" />
      <div className="warning-stripes stripe-bottom pointer-events-none absolute inset-x-0 bottom-0 z-10 h-11 opacity-90" />

      <div
        className={`flex flex-col items-center pt-14 text-center ${game.ringIntro ? "ring-banner" : ""}`}
      >
        <div className="text-5xl" style={{ animation: "bounce-icon 0.55s ease-in-out infinite" }}>
          🚨
        </div>
        <h1 className="mt-2 text-3xl font-black tracking-wide text-red-100 sm:text-5xl">
          ALARM ACTIVE
        </h1>
        <p className="mt-2 text-sm font-bold uppercase tracking-[0.35em] text-amber-200">
          Catch me if you can
        </p>
        {game.panic && (
          <div className="mt-3 rounded-full bg-red-600 px-4 py-1 text-xs font-black tracking-[0.25em] text-white shadow-[0_0_24px_rgba(255,40,60,0.7)]">
            PANIC MODE
          </div>
        )}
        <div
          className={`clock-font mt-5 text-5xl font-black ${game.soClose ? "text-amber-200" : "text-white"}`}
          style={game.soClose ? { animation: "shake 0.4s ease" } : undefined}
          aria-live="polite"
        >
          {game.soClose ? "SO CLOSE" : formatMs(game.timerLeft)}
        </div>
        <p className="mt-2 max-w-xs text-xs text-white/50">
          The button can smell fear. On a phone, hover your finger near it — it will still run.
        </p>
      </div>

      <ChaseLayer game={game} pointer={pointer} />
    </div>
  );
}
