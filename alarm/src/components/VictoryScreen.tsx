import { VICTORY_BAIT } from "../data/ragebait";
import type { AlarmGame } from "../game/useAlarmGame";

function Confetti() {
  const bits = Array.from({ length: 36 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.8,
    color: ["#ff3b6b", "#ffd166", "#7ee787", "#7aa2ff", "#f9a8d4"][i % 5],
    w: 6 + (i % 5),
  }));
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {bits.map((b) => (
        <span
          key={b.id}
          className="absolute top-0 rounded-sm"
          style={{
            left: `${b.left}%`,
            width: b.w,
            height: b.w * 1.6,
            background: b.color,
            animation: `confetti ${2.4 + (b.id % 5) * 0.2}s linear ${b.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

export function VictoryScreen({ game }: { game: AlarmGame }) {
  const s = game.stats;
  const chase = (s.chaseMs / 1000).toFixed(1);
  return (
    <div className="relative z-10 mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-5 px-4 py-10">
      <Confetti />
      <div className="rounded-3xl border border-emerald-300/30 bg-emerald-500/10 p-6 text-center">
        <div className="text-5xl">🏆</div>
        <h1 className="mt-2 text-3xl font-black">ALARM DEFEATED</h1>
        <p className="mt-1 text-white/70">You survived.</p>
        <div className="ml mt-5 space-y-1 text-lg">
          {VICTORY_BAIT.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-2 text-sm">
        <Stat label="Chase duration" value={`${chase}s`} />
        <Stat label="Questions" value={String(s.questionsAnswered)} />
        <Stat label="Wrong answers" value={String(s.wrongAnswers)} />
        <Stat label="Longest streak" value={String(s.longestStreak)} />
        <Stat label="Button escaped" value={String(s.buttonEscapes)} />
        <Stat label="Fake buttons" value={String(s.fakeClicks)} />
      </dl>

      <button
        type="button"
        className="interactive-btn rounded-2xl bg-gradient-to-r from-rose-500 to-orange-400 py-4 font-extrabold"
        onClick={game.reset}
      >
        SET ANOTHER ALARM
      </button>
      <button
        type="button"
        className="interactive-btn rounded-2xl border border-white/15 py-3 text-sm text-white/70"
        onClick={() => {
          game.reset();
        }}
      >
        EXIT
      </button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
      <dt className="text-[10px] uppercase tracking-wider text-white/40">{label}</dt>
      <dd className="mt-1 font-bold">{value}</dd>
    </div>
  );
}
