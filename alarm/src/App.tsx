import { Background } from "./components/Background";
import { ChallengeScreen } from "./components/ChallengeScreen";
import { HomeScreen } from "./components/HomeScreen";
import { RingingScreen } from "./components/RingingScreen";
import { SettingsPanel } from "./components/SettingsPanel";
import { VictoryScreen } from "./components/VictoryScreen";
import { useAlarmGame } from "./game/useAlarmGame";
import { usePointer } from "./hooks/usePointer";

export default function App() {
  const game = useAlarmGame();
  const pointer = usePointer();

  const fx =
    game.screenFx === "shake"
      ? "fx-shake"
      : game.screenFx === "pulse" || game.arming
        ? "fx-pulse fx-arm"
        : "";

  return (
    <div
      className={`relative min-h-dvh overflow-hidden ${fx}`}
      style={{
        filter: game.arming || game.screenFx === "dim" ? "brightness(0.55)" : undefined,
      }}
    >
      <Background status={game.status} pointer={pointer} beat={game.beat} />

      {(game.status === "OFF" || game.status === "ARMED") && <HomeScreen game={game} />}
      {game.status === "RINGING" && <RingingScreen game={game} pointer={pointer} />}
      {game.status === "CHALLENGE" && <ChallengeScreen game={game} />}
      {game.status === "DEFEATED" && <VictoryScreen game={game} />}

      <SettingsPanel game={game} />

      <button
        type="button"
        className="interactive-btn fixed bottom-3 right-3 z-20 rounded-full border border-white/10 bg-black/40 px-3 py-2 text-[10px] uppercase tracking-wider text-white/50"
        onClick={() => game.setSettingsOpen(true)}
        aria-label="Volume and settings"
      >
        🔊 {Math.round(game.volume * 100)}
      </button>
    </div>
  );
}
