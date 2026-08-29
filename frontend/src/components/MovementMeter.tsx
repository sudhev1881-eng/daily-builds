interface MovementMeterProps {
  intensity: number;
  velocity: number;
  direction: number | null;
}

export function MovementMeter({
  intensity,
  velocity,
  direction,
}: MovementMeterProps) {
  const angleDeg = direction !== null ? (direction * 180) / Math.PI : 0;

  return (
    <div className="glass-panel p-4">
      <h3 className="mb-3 font-mono text-xs tracking-wider text-slate-500 uppercase">
        Movement Intensity
      </h3>

      <div className="relative mx-auto mb-3 h-28 w-28">
        <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
          <circle
            cx="60"
            cy="60"
            r="50"
            fill="none"
            stroke="rgba(30,41,59,0.8)"
            strokeWidth="8"
          />
          <circle
            cx="60"
            cy="60"
            r="50"
            fill="none"
            stroke="url(#meterGradient)"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${(intensity / 100) * 314} 314`}
            className="transition-all duration-300"
          />
          <defs>
            <linearGradient id="meterGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#0ea5e9" />
              <stop offset="100%" stopColor="#38bdf8" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-2xl font-bold text-sky-300">
            {intensity.toFixed(0)}
          </span>
          <span className="font-mono text-[10px] text-slate-500">%</span>
        </div>
      </div>

      <div className="flex justify-between font-mono text-[10px] text-slate-500">
        <span>Velocity: {velocity.toFixed(2)} m/s</span>
        {direction !== null && (
          <span className="flex items-center gap-1">
            Dir:
            <span
              className="inline-block text-sky-400"
              style={{ transform: `rotate(${angleDeg}deg)` }}
            >
              →
            </span>
            {angleDeg.toFixed(0)}°
          </span>
        )}
      </div>
    </div>
  );
}
