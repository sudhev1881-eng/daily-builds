import { pad } from "../hooks/useNow";

interface Props {
  now: number;
  large?: boolean;
  pulse?: boolean;
}

export function DigitalClock({ now, large, pulse }: Props) {
  const d = new Date(now);
  const h = pad(d.getHours());
  const m = pad(d.getMinutes());
  const s = pad(d.getSeconds());
  const ms = d.getMilliseconds();
  const secFrac = (d.getSeconds() + ms / 1000) / 60;
  const r = 54;
  const circ = 2 * Math.PI * r;
  const dash = circ * secFrac;

  return (
    <div className={`hero-clock relative mx-auto text-center ${pulse ? "fx-pulse" : ""}`}>
      <svg
        viewBox="0 0 120 120"
        className="pointer-events-none absolute left-1/2 top-1/2 h-[118%] w-[118%] -translate-x-1/2 -translate-y-1/2 opacity-70"
        aria-hidden
      >
        <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="url(#secGlow)"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          transform="rotate(-90 60 60)"
        />
        <defs>
          <linearGradient id="secGlow" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ff3b6b" />
            <stop offset="100%" stopColor="#ffd166" />
          </linearGradient>
        </defs>
      </svg>

      <div
        className={`clock-font relative font-extrabold tracking-[0.08em] ${
          large ? "text-6xl sm:text-8xl" : "text-4xl sm:text-5xl"
        }`}
        style={{ textShadow: "0 0 28px rgba(255,59,107,0.4)" }}
      >
        {h}
        <span className={ms < 500 ? "opacity-100" : "opacity-20"}>:</span>
        {m}
      </div>
      <div
        key={s}
        className="clock-font relative mt-1 text-2xl text-rose-300/90 sm:text-3xl"
        style={{ animation: "tick-pop 240ms ease" }}
        aria-hidden
      >
        :{s}
      </div>
      <p className="relative mt-1 text-[10px] uppercase tracking-[0.4em] text-white/30">
        live seconds
      </p>
    </div>
  );
}
