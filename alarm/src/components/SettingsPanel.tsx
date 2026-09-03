import type { AlarmGame } from "../game/useAlarmGame";
import { MagneticButton } from "./MagneticButton";
import { alarmAudio } from "../audio/AlarmAudio";

export function SettingsPanel({ game }: { game: AlarmGame }) {
  if (!game.settingsOpen) return null;
  const on = game.volume > 0.02;
  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/55 p-4 sm:items-center"
      role="dialog"
      aria-labelledby="settings-title"
    >
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#120c14] p-5 shadow-2xl ring-banner">
        <div className="flex items-start justify-between">
          <div>
            <h2 id="settings-title" className="text-xl font-extrabold">
              Settings
            </h2>
            <p className="mt-1 text-xs text-white/45">There is no setting for escaping.</p>
          </div>
          <MagneticButton
            type="button"
            className="rounded-lg bg-white/10 px-3 py-1 text-sm"
            onClick={() => game.setSettingsOpen(false)}
          >
            Close
          </MagneticButton>
        </div>

        <div className="mt-6 flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
          <span className="text-sm">Sound</span>
          <button
            type="button"
            className="relative h-7 w-12 rounded-full bg-white/10"
            aria-pressed={on}
            onClick={() => game.setVolume(on ? 0 : 0.55)}
          >
            <span
              className={`absolute top-1 left-1 h-5 w-5 rounded-full transition-transform duration-200 ${
                on ? "translate-x-[18px] bg-rose-400" : "bg-white/50"
              }`}
            />
          </button>
        </div>

        <label className="mt-5 block text-sm text-white/70">
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
          Ringtone is a barking dog, generated in your browser. Malayalam trolls are read out
          loud when you click them. Turn it down if your neighbors already hate you.
        </p>
        <MagneticButton
          type="button"
          className="mt-4 w-full rounded-2xl border border-white/15 bg-white/5 py-2 text-sm"
          onClick={() => {
            alarmAudio.previewBark();
            alarmAudio.speak("പിടിക്കാൻ പറ്റുമെങ്കിൽ പിടിക്കടാ");
          }}
        >
          Test bark + troll voice
        </MagneticButton>
      </div>
    </div>
  );
}
