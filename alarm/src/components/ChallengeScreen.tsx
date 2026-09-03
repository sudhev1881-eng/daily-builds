import { STREAK_GOAL } from "../game/types";
import type { AlarmGame } from "../game/useAlarmGame";
import { formatMs } from "../hooks/useNow";

export function ChallengeScreen({ game }: { game: AlarmGame }) {
  const q = game.question;
  if (!q) return null;
  const progress = (game.streak / STREAK_GOAL) * 100;

  return (
    <div className="relative z-10 mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-5 px-4 py-10">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-amber-200/70">Challenge</p>
          <h2 className="text-xl font-black">Prove you are awake</h2>
        </div>
        <div
          className={`clock-font text-3xl font-black ${game.soClose ? "text-amber-200" : ""}`}
          style={game.soClose ? { animation: "shake 0.35s ease" } : undefined}
        >
          {game.soClose ? "SO CLOSE" : formatMs(game.timerLeft)}
        </div>
      </div>

      <div className="rounded-2xl border border-amber-200/20 bg-amber-400/10 p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="font-bold">CORRECT STREAK</span>
          <span>
            🔥 {game.streak} / {STREAK_GOAL}
          </span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/40">
          <div
            className="progress-fill h-full bg-gradient-to-r from-amber-300 to-rose-400 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {game.lastResult === "correct" && (
        <div className="combo-burst pointer-events-none absolute left-1/2 top-24 z-20 -translate-x-1/2 rounded-full bg-emerald-400 px-4 py-1 text-sm font-black text-emerald-950">
          CORRECT
        </div>
      )}
      {game.penaltyFlash && (
        <div className="combo-burst pointer-events-none absolute left-1/2 top-24 z-20 -translate-x-1/2 rounded-full bg-rose-500 px-4 py-1 text-sm font-black text-white">
          +2:00
        </div>
      )}

      <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <p className="text-lg font-bold leading-snug">{q.prompt}</p>
        <div className="mt-4 grid gap-2">
          {q.options.map((opt, i) => {
            const hiding =
              game.revealTrick && i !== q.correctIndex && game.lastResult === "correct";
            const showCorrect = game.lastResult === "correct" && i === q.correctIndex;
            const pickedWrong =
              game.lastResult === "wrong" && game.pickedIndex === i;
            const compressing = game.lockAnswers && game.pickedIndex === i && !game.lastResult;
            return (
              <button
                key={opt}
                type="button"
                disabled={game.lockAnswers}
                onClick={() => game.answer(i)}
                className={`answer-btn rounded-2xl border px-4 py-3 text-left text-sm font-semibold ${
                  hiding ? "pointer-events-none scale-90 opacity-0" : "opacity-100"
                } ${
                  showCorrect
                    ? "scale-105 border-emerald-300 bg-emerald-400/25"
                    : pickedWrong
                      ? "border-rose-400 bg-rose-500/20"
                      : compressing
                        ? "scale-95 border-white/20 bg-white/10"
                        : "border-white/10 bg-white/5"
                }`}
              >
                {opt}
              </button>
            );
          })}
        </div>

        {game.lastResult === "correct" && (
          <p className="mt-4 text-center text-lg font-black text-emerald-300">✓ CORRECT</p>
        )}
        {game.lastResult === "wrong" && (
          <p className="mt-4 text-center text-lg font-black text-rose-300">✕ WRONG</p>
        )}
        {game.revealTrick && (
          <div className="mt-2 text-center">
            <p className="text-sm font-bold tracking-wide text-amber-200">YOU FELL FOR IT.</p>
            {q.reveal && <p className="mt-1 text-xs text-white/50">{q.reveal}</p>}
          </div>
        )}
        {game.baitLine && (
          <p className="ml mt-2 text-center text-base text-rose-100">{game.baitLine}</p>
        )}
      </div>
    </div>
  );
}
