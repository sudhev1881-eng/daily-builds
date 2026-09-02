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

  return (
    <div className={`hero-clock text-center ${pulse ? "fx-pulse" : ""}`}>
      <div
        className={`clock-font font-extrabold tracking-[0.08em] ${
          large ? "text-6xl sm:text-8xl" : "text-4xl sm:text-5xl"
        }`}
        style={{ textShadow: "0 0 28px rgba(255,59,107,0.35)" }}
      >
        {h}
        <span className={ms < 500 ? "opacity-100" : "opacity-25"}>:</span>
        {m}
      </div>
      <div
        key={s}
        className="clock-font mt-1 text-2xl text-rose-300/90 sm:text-3xl"
        style={{ animation: "tick-pop 220ms ease" }}
      >
        :{s}
      </div>
    </div>
  );
}
