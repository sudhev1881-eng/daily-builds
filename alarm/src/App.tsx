import { useEffect } from "react";
import { Background } from "./components/Background";
import { ChallengeScreen } from "./components/ChallengeScreen";
import { HomeScreen } from "./components/HomeScreen";
import { RingingScreen } from "./components/RingingScreen";
import { SettingsPanel } from "./components/SettingsPanel";
import { VictoryScreen } from "./components/VictoryScreen";
import { useAlarmGame } from "./game/useAlarmGame";
import { usePointer } from "./hooks/usePointer";
import { MagneticButton } from "./components/MagneticButton";

export default function App() {
  const game = useAlarmGame();
  const pointer = usePointer();

  useEffect(() => {
    const mode = new URLSearchParams(window.location.search).get("demo");
    if (mode) game.applyDemo(mode);
    // run once on mount for review screenshots / QA
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fx =
    game.screenFx === "shake"
      ? "fx-shake"
      : game.screenFx === "pulse" || game.armPhase === "expand"
        ? "fx-pulse fx-arm"
        : game.screenFx === "celebrate"
          ? "fx-celebrate"
          : "";

  const modeClass =
    game.status === "RINGING"
      ? "mode-ringing"
      : game.status === "CHALLENGE"
        ? "mode-challenge"
        : game.status === "DEFEATED"
          ? "mode-win"
          : game.status === "ARMED"
            ? "mode-armed"
            : "mode-off";

  return (
    <div
      className={`relative min-h-dvh overflow-hidden ${fx} ${modeClass}`}
      style={{
        filter:
          game.armPhase === "press" || game.armPhase === "dim" || game.screenFx === "dim"
            ? "brightness(0.52)"
            : undefined,
      }}
    >
      <Background status={game.status} pointer={pointer} beat={game.beat} />
      <div className="cursor-glow" aria-hidden />

      {(game.armPhase === "press" || game.armPhase === "dim") && (
        <div className="dim-overlay pointer-events-none absolute inset-0 z-20 bg-black/35" />
      )}

      <div className="sr-only" aria-live="polite">
        {game.status}
      </div>

      {(game.status === "OFF" || game.status === "ARMED") && <HomeScreen game={game} />}
      {game.status === "RINGING" && <RingingScreen game={game} pointer={pointer} />}
      {game.status === "CHALLENGE" && <ChallengeScreen game={game} />}
      {game.status === "DEFEATED" && <VictoryScreen game={game} />}

      <SettingsPanel game={game} />

      <MagneticButton
        type="button"
        className="fixed bottom-3 right-3 z-20 rounded-full border border-white/10 bg-black/40 px-3 py-2 text-[10px] uppercase tracking-wider text-white/50"
        onClick={() => game.setSettingsOpen(true)}
        aria-label="Volume and settings"
      >
        🔊 VOL {Math.round(game.volume * 100)}
      </MagneticButton>
    </div>
  );
}
