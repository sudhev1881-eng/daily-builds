import { formatHms } from "../hooks/useNow";
import type { AlarmGame } from "../game/useAlarmGame";
import { DigitalClock } from "./DigitalClock";
import { StatusBadge } from "./StatusBadge";
import { TimeSelector } from "./TimeSelector";

export function HomeScreen({ game }: { game: AlarmGame }) {
  const closeness =
    game.status === "ARMED" && game.remainingToAlarm > 0
      ? Math.max(0, 1 - game.remainingToAlarm / (8 * 3600 * 1000))
      : 0;
  const imminent = game.status === "ARMED" && game.remainingToAlarm < 5 * 60 * 1000;

  return (
    <div className="relative z-10 mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-5 px-4 py-8">
      <header className="flex items-start justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.35em] text-rose-300/70">
            Extremely Unhelpful Alarm
          </p>
          <h1 className="mt-1 text-2xl font-extrabold">Wake Up Anyway</h1>
        </div>
        <button
          type="button"
          className="interactive-btn rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs"
          onClick={() => game.setSettingsOpen(true)}
        >
          Settings
        </button>
      </header>

      <DigitalClock now={game.now} large pulse={game.screenFx === "pulse" || game.arming} />

      <section
        className="alarm-card rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-md"
        style={{
          boxShadow: imminent
            ? `0 0 ${18 + closeness * 30}px rgba(255,59,107,${0.2 + closeness * 0.35})`
            : "0 10px 40px rgba(0,0,0,0.35)",
          transform: imminent ? `scale(${1 + closeness * 0.02})` : undefined,
        }}
      >
        <StatusBadge status={game.status} />

        {game.status === "ARMED" ? (
          <div className="mt-4 text-center">
            <p className="text-[10px] uppercase tracking-[0.3em] text-white/40">Alarm in</p>
            <p
              className={`clock-font mt-1 text-3xl font-bold ${imminent ? "text-rose-300" : "text-white"}`}
            >
              {formatHms(game.remainingToAlarm / 1000)}
            </p>
            <p className="mt-2 text-sm text-white/50">Good luck.</p>
            <div className="mx-auto mt-3 h-1.5 w-40 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full bg-rose-400"
                style={{
                  width: `${Math.min(100, 100 - (game.remainingToAlarm / (12 * 3600 * 1000)) * 100)}%`,
                }}
              />
            </div>
            <button
              type="button"
              className="interactive-btn mt-4 text-xs text-white/40 underline"
              onClick={game.disarm}
            >
              Disarm (coward)
            </button>
          </div>
        ) : (
          <div className="mt-5 space-y-5">
            <TimeSelector
              hour={game.hour}
              minute={game.minute}
              onHour={game.setHour}
              onMinute={game.setMinute}
              disabled={game.arming}
            />
            <button
              type="button"
              className="interactive-btn w-full rounded-2xl bg-gradient-to-r from-rose-500 to-orange-400 py-4 text-lg font-extrabold tracking-wide text-white shadow-[0_8px_30px_rgba(255,59,107,0.35)]"
              onClick={() => game.setAlarm()}
              disabled={game.arming}
            >
              {game.arming ? "ARMING…" : "SET ALARM"}
            </button>
            <button
              type="button"
              className="interactive-btn w-full rounded-2xl border border-white/15 bg-white/5 py-3 text-sm text-white/80"
              onClick={() => game.setAlarm({ delayMs: 10_000 })}
              disabled={game.arming}
            >
              Wake me in 10 seconds
            </button>
            <p className="text-center text-[11px] text-white/35">
              {game.arming
                ? "You probably shouldn't have done that."
                : "Alarm set successfully — after you press the button."}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
