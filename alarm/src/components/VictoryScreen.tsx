import { useEffect } from "react";
import { alarmAudio } from "../audio/AlarmAudio";
import { VICTORY_LINES } from "../data/ragebait";
import type { AlarmGame } from "../game/useAlarmGame";
import { MagneticButton } from "./MagneticButton";

function Confetti() {
  const bits = Array.from({ length: 42 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.9,
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

  useEffect(() => {
    const first = VICTORY_LINES[0];
    if (first) alarmAudio.speak(first);
    const id = window.setTimeout(() => {
      const second = VICTORY_LINES[1];
      if (second) alarmAudio.speak(second);
    }, 2400);
    return () => window.clearTimeout(id);
  }, []);
  return (
    <div className="relative z-10 mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-5 px-4 py-10">
      <Confetti />
      <div className="rounded-3xl border border-emerald-300/30 bg-emerald-500/10 p-6 text-center ring-banner">
        <div className="text-5xl">🏆</div>
        <h1 className="mt-2 text-3xl font-black">ALARM DEFEATED</h1>
        <p className="mt-1 text-white/70">You survived.</p>
        <div className="ml mt-5 space-y-1 text-lg">
          {VICTORY_LINES.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-2 text-sm">
        <Stat label="Chase duration" value={`${chase}s`} delay={0} />
        <Stat label="Questions" value={String(s.questionsAnswered)} delay={70} />
        <Stat label="Wrong answers" value={String(s.wrongAnswers)} delay={140} />
        <Stat label="Longest streak" value={String(s.longestStreak)} delay={210} />
        <Stat label="Button escaped" value={String(s.buttonEscapes)} delay={280} />
        <Stat label="Fake buttons" value={String(s.fakeClicks)} delay={350} />
      </dl>

      <MagneticButton
        type="button"
        className="rounded-2xl bg-gradient-to-r from-rose-500 to-orange-400 py-4 font-extrabold"
        onClick={game.reset}
      >
        SET ANOTHER ALARM
      </MagneticButton>
      <MagneticButton
        type="button"
        className="rounded-2xl border border-white/15 py-3 text-sm text-white/70"
        onClick={game.reset}
      >
        EXIT
      </MagneticButton>
    </div>
  );
}

function Stat({ label, value, delay }: { label: string; value: string; delay: number }) {
  return (
    <div className="stat-card rounded-2xl border border-white/10 bg-white/5 px-3 py-3" style={{ animationDelay: `${delay}ms` }}>
      <dt className="text-[10px] uppercase tracking-wider text-white/40">{label}</dt>
      <dd className="mt-1 font-bold">{value}</dd>
    </div>
  );
}
