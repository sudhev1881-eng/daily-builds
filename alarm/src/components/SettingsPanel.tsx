import type { AlarmGame } from "../game/useAlarmGame";

export function SettingsPanel({ game }: { game: AlarmGame }) {
  if (!game.settingsOpen) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/55 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#120c14] p-5 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-extrabold">Settings</h2>
            <p className="mt-1 text-xs text-white/45">There is no setting for escaping.</p>
          </div>
          <button
            type="button"
            className="interactive-btn rounded-lg bg-white/10 px-3 py-1 text-sm"
            onClick={() => game.setSettingsOpen(false)}
          >
            Close
          </button>
        </div>
        <label className="mt-6 block text-sm text-white/70">
          Volume
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={game.volume}
            onChange={(e) => game.setVolume(Number(e.target.value))}
            className="mt-2 w-full accent-rose-400"
          />
        </label>
        <p className="mt-4 text-[11px] leading-relaxed text-white/40">
          Beeps are generated in your browser. They will pulse with the red
          flashes. Turn it down if your neighbors already hate you.
        </p>
      </div>
    </div>
  );
}
