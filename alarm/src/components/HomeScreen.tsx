import { formatHms } from "../hooks/useNow";
import type { AlarmGame } from "../game/useAlarmGame";
import { DigitalClock } from "./DigitalClock";
import { MagneticButton } from "./MagneticButton";
import { StatusBadge } from "./StatusBadge";
import { TiltCard } from "./TiltCard";
import { TimeSelector } from "./TimeSelector";

function closeness(remaining: number) {
  if (remaining <= 0) return 0;
  if (remaining < 60_000) return 1;
  if (remaining < 3 * 60_000) return 0.92;
  if (remaining < 8 * 60_000) return 0.75;
  if (remaining < 20 * 60_000) return 0.5;
  if (remaining < 60 * 60_000) return 0.28;
  return 0.12;
}

export function HomeScreen({ game }: { game: AlarmGame }) {
  const hot = game.status === "ARMED";
  const level = hot ? closeness(game.remainingToAlarm) : 0;
  const critical = hot && game.remainingToAlarm < 3 * 60 * 1000;
  const imminent = hot && game.remainingToAlarm < 15 * 60 * 1000;
  const ring = Math.min(1, 1 - game.remainingToAlarm / (12 * 3600 * 1000));

  return (
    <div className="relative z-10 mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-5 px-4 py-8">
      <header className="flex items-start justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.35em] text-rose-300/70">
            Extremely Unhelpful Alarm
          </p>
          <h1 className="mt-1 text-2xl font-extrabold">Wake Up Anyway</h1>
        </div>
        <MagneticButton
          type="button"
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs"
          onClick={() => game.setSettingsOpen(true)}
        >
          Settings
        </MagneticButton>
      </header>
      <p className="-mt-3 text-[11px] text-white/35">There is no setting for escaping.</p>

      <DigitalClock
        now={game.now}
        large
        pulse={game.screenFx === "pulse" || game.armPhase === "expand"}
      />

      <TiltCard
        className={`alarm-card rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-md ${
          critical ? "is-critical" : imminent ? "is-hot" : ""
        } ${game.armPhase === "expand" ? "fx-arm" : ""}`}
        intensity={8}
      >
        <StatusBadge status={game.status} />

        {game.status === "ARMED" ? (
          <div className="mt-4 text-center">
            <p className="text-[10px] uppercase tracking-[0.3em] text-white/40">Alarm in</p>
            <p
              className={`clock-font mt-1 text-3xl font-bold ${
                imminent ? "text-rose-300" : "text-white"
              }`}
              style={{
                textShadow: imminent
                  ? `0 0 ${12 + level * 24}px rgba(255,59,107,${0.3 + level * 0.5})`
                  : undefined,
              }}
            >
              {formatHms(game.remainingToAlarm / 1000)}
            </p>
            <p className="mt-2 text-sm text-white/55">Good luck.</p>
            <div
              className="mx-auto mt-4 h-16 w-16"
              aria-hidden
              style={{ animation: imminent ? "npc-bob 1.1s ease-in-out infinite" : undefined }}
            >
              <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
                <circle
                  cx="18"
                  cy="18"
                  r="15"
                  fill="none"
                  stroke="rgba(255,255,255,0.1)"
                  strokeWidth="3"
                />
                <circle
                  cx="18"
                  cy="18"
                  r="15"
                  fill="none"
                  stroke="#ff3b6b"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={`${ring * 94} 94`}
                />
              </svg>
            </div>
            <MagneticButton
              type="button"
              className="mt-3 text-xs text-white/40 underline"
              onClick={game.disarm}
            >
              Disarm (coward)
            </MagneticButton>
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
            <MagneticButton
              type="button"
              className={`w-full rounded-2xl bg-gradient-to-r from-rose-500 to-orange-400 py-4 text-lg font-extrabold tracking-wide text-white shadow-[0_8px_30px_rgba(255,59,107,0.35)] ${
                game.armPhase === "press" ? "scale-90" : ""
              }`}
              onClick={() => game.setAlarm()}
              disabled={game.arming}
              pull={0.12}
            >
              {game.arming ? "ARMING…" : "SET ALARM"}
            </MagneticButton>
            <MagneticButton
              type="button"
              className="w-full rounded-2xl border border-white/15 bg-white/5 py-3 text-sm text-white/80"
              onClick={() => game.setAlarm({ delayMs: 10_000 })}
              disabled={game.arming}
            >
              Wake me in 10 seconds
            </MagneticButton>
            <p className="text-center text-[11px] text-white/35">
              {game.armPhase === "press" || game.armPhase === "dim"
                ? "You probably shouldn't have done that."
                : "Alarm set successfully — after you press the button."}
            </p>
          </div>
        )}
      </TiltCard>
    </div>
  );
}
