import { STREAK_GOAL } from "../game/types";
import type { AlarmGame } from "../game/useAlarmGame";
import { formatMs } from "../hooks/useNow";

export function ChallengeScreen({ game }: { game: AlarmGame }) {
  const q = game.question;
  if (!q) return null;

  return (
    <div className="relative z-10 mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-5 px-4 py-10">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-amber-200/70">Challenge</p>
          <h2 className="text-xl font-black">Prove you are awake</h2>
        </div>
        <div
          className={`clock-font text-3xl font-black ${game.soClose ? "text-amber-200" : ""}`}
        >
          {game.soClose ? "SO CLOSE" : formatMs(game.timerLeft)}
        </div>
      </div>

      <div className="rounded-2xl border border-amber-200/20 bg-amber-400/10 p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="font-bold">CORRECT STREAK</span>
          <span>🔥 {game.streak} / {STREAK_GOAL}</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/40">
          <div
            className="h-full bg-gradient-to-r from-amber-300 to-rose-400 transition-all duration-500"
            style={{ width: `${(game.streak / STREAK_GOAL) * 100}%` }}
          />
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <p className="text-lg font-bold leading-snug">{q.prompt}</p>
        <div className="mt-4 grid gap-2">
          {q.options.map((opt, i) => {
            const hiding =
              game.revealTrick && i !== q.correctIndex && game.lastResult === "correct";
            const showCorrect =
              game.lastResult === "correct" && i === q.correctIndex;
            const showWrong =
              game.lastResult === "wrong" && game.lockAnswers;
            return (
              <button
                key={opt}
                type="button"
                disabled={game.lockAnswers}
                onClick={() => game.answer(i)}
                className={`answer-btn rounded-2xl border px-4 py-3 text-left text-sm font-semibold ${
                  hiding ? "scale-95 opacity-0" : "opacity-100"
                } ${
                  showCorrect
                    ? "border-emerald-300 bg-emerald-400/20"
                    : showWrong
                      ? "border-white/10 bg-white/5"
                      : "border-white/10 bg-white/5 hover:border-amber-200/40 hover:bg-amber-300/10"
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
          <p className="mt-2 text-center text-sm font-bold tracking-wide text-amber-200">
            YOU FELL FOR IT.
          </p>
        )}
        {game.baitLine && (
          <p className="ml mt-2 text-center text-base text-rose-100">{game.baitLine}</p>
        )}
      </div>
    </div>
  );
}
