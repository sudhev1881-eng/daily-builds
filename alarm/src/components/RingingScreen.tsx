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
  const beatAge = Math.max(0, 1 - (performance.now() - game.beat) / 300);

  return (
    <div className="relative z-10 min-h-dvh overflow-hidden">
      <div
        className="warning-stripes pointer-events-none absolute inset-x-0 top-0 h-10 opacity-80"
        style={{ opacity: 0.45 + beatAge * 0.4 }}
      />
      <div className="warning-stripes pointer-events-none absolute inset-x-0 bottom-0 h-10 opacity-80" />

      <div className="flex flex-col items-center pt-14 text-center">
        <div
          className="text-5xl"
          style={{ animation: "bounce-icon 0.55s ease-in-out infinite" }}
        >
          🚨
        </div>
        <h1 className="mt-2 text-3xl font-black tracking-wide text-red-100 sm:text-5xl">
          ALARM ACTIVE
        </h1>
        <p className="mt-2 text-sm font-bold uppercase tracking-[0.35em] text-amber-200">
          Catch me if you can
        </p>
        <div
          className={`clock-font mt-5 text-5xl font-black ${game.soClose ? "text-amber-200" : "text-white"}`}
          style={game.soClose ? { animation: "shake 0.4s ease" } : undefined}
        >
          {game.soClose ? "SO CLOSE" : formatMs(game.timerLeft)}
        </div>
        <p className="mt-2 max-w-xs text-xs text-white/50">
          The button can smell fear. On a phone, hover your finger near it —
          it will still run.
        </p>
      </div>

      <ChaseLayer game={game} pointer={pointer} />
    </div>
  );
}
