interface CalibrationOverlayProps {
  remaining: number | null;
  roomStatus: string;
}

export function CalibrationOverlay({
  remaining,
  roomStatus,
}: CalibrationOverlayProps) {
  const isBooting = roomStatus === "BOOTING";
  const isBaseline = roomStatus === "BASELINE ESTABLISHED";

  if (!isBooting && !isBaseline) return null;

  const countdown = remaining !== null ? Math.ceil(remaining) : 0;

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm">
      <div className="text-center">
        {isBooting ? (
          <>
            <div className="mb-2 font-mono text-xs tracking-[0.3em] text-sky-400 uppercase">
              Initializing Room Sensor
            </div>
            <div className="mb-4 font-mono text-6xl font-bold text-sky-300 tabular-nums">
              {countdown}
            </div>
            <p className="font-mono text-xs text-slate-500">
              Keep the room empty. Learning quiet-room RSSI, CSI amplitude & phase...
            </p>
            <p className="mt-1 font-mono text-[10px] text-slate-600">
              If the window is not quiet, calibration restarts automatically.
            </p>
            <div className="mx-auto mt-4 h-1 w-48 overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full bg-sky-500 transition-all duration-300"
                style={{
                  width: `${((10 - (remaining ?? 0)) / 10) * 100}%`,
                }}
              />
            </div>
          </>
        ) : (
          <>
            <div className="mb-2 font-mono text-xs tracking-[0.3em] text-emerald-400 uppercase">
              Baseline Established
            </div>
            <p className="font-mono text-sm text-emerald-300">
              Detection active
            </p>
          </>
        )}
      </div>
    </div>
  );
}
