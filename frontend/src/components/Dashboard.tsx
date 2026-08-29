import { useEffect, useRef, useState } from "react";
import { useWebSocket } from "../hooks/useWebSocket";
import type { HeatmapCell, RoomStatus, TrailPoint } from "../types/sensor";
import {
  HEATMAP_MIN_MOVEMENT,
  HEATMAP_MIN_PRESENCE,
  TRAIL_MIN_DISTANCE_M,
} from "../types/sensor";
import { CalibrationOverlay } from "./CalibrationOverlay";
import { ConfigPanel } from "./ConfigPanel";
import { MovementMeter } from "./MovementMeter";
import { RoomVisualization } from "./RoomVisualization";
import { SignalGraph } from "./SignalGraph";
import { SimulationBanner } from "./SimulationBanner";
import { StatusPanel } from "./StatusPanel";
import { WaveformChart } from "./WaveformChart";

const DEFAULT_ROOM = {
  width: 8,
  height: 6,
  router: { x: 1, y: 5.5 },
  receiver: { x: 7, y: 0.5 },
};

export function Dashboard() {
  const { reading, connected, simulationMode, room, sendConfig } =
    useWebSocket();
  const [rssiHistory, setRssiHistory] = useState<
    { time: string; rssi: number }[]
  >([]);
  const [trails, setTrails] = useState<TrailPoint[]>([]);
  const [heatmap, setHeatmap] = useState<HeatmapCell[]>([]);
  const heatmapRef = useRef<Map<string, number>>(new Map());
  const lastTrailPos = useRef<{ x: number; y: number } | null>(null);

  const currentRoom = room || reading?.room || DEFAULT_ROOM;
  const roomStatus: RoomStatus = reading?.room_status ?? "BOOTING";
  const isCalibrating =
    roomStatus === "BOOTING" || roomStatus === "BASELINE ESTABLISHED";
  const personVisible = reading?.person_visible ?? false;
  const personMoving = roomStatus === "HUMAN MOVING";

  // Stable person coordinates — only pass live position when person is visible
  const displayX = personVisible ? (reading?.x ?? currentRoom.width / 2) : currentRoom.width / 2;
  const displayY = personVisible ? (reading?.y ?? currentRoom.height / 2) : currentRoom.height / 2;

  useEffect(() => {
    if (!reading) return;

    const time = new Date(reading.timestamp).toLocaleTimeString();
    setRssiHistory((prev) => [...prev.slice(-120), { time, rssi: reading.rssi }]);

    // Only add trails/heatmap for confirmed human movement
    const isHumanMoving =
      reading.room_status === "HUMAN MOVING" &&
      reading.presence_probability >= HEATMAP_MIN_PRESENCE &&
      reading.movement_probability >= HEATMAP_MIN_MOVEMENT;

    if (isHumanMoving && reading.person_visible) {
      const last = lastTrailPos.current;
      const dist = last
        ? Math.hypot(reading.x - last.x, reading.y - last.y)
        : TRAIL_MIN_DISTANCE_M;

      if (dist >= TRAIL_MIN_DISTANCE_M) {
        lastTrailPos.current = { x: reading.x, y: reading.y };
        setTrails((prev) => [
          ...prev.slice(-150),
          {
            x: reading.x,
            y: reading.y,
            timestamp: Date.now(),
            intensity: reading.movement_intensity / 100,
          },
        ]);

        const cellX = Math.round(reading.x * 2) / 2;
        const cellY = Math.round(reading.y * 2) / 2;
        const key = `${cellX},${cellY}`;
        const current = heatmapRef.current.get(key) || 0;
        heatmapRef.current.set(
          key,
          Math.min(1, current + reading.movement_intensity / 300)
        );
      }
    }

    // Gradual heatmap decay
    for (const [key, val] of heatmapRef.current.entries()) {
      const decayed = val * 0.992;
      if (decayed < 0.01) heatmapRef.current.delete(key);
      else heatmapRef.current.set(key, decayed);
    }

    const cells: HeatmapCell[] = [];
    for (const [key, intensity] of heatmapRef.current.entries()) {
      const [x, y] = key.split(",").map(Number);
      cells.push({ x, y, intensity });
    }
    setHeatmap(cells);
  }, [reading]);

  return (
    <div className="flex h-full flex-col">
      <SimulationBanner active={simulationMode} />

      <header className="flex items-center justify-between border-b border-slate-800/50 px-6 py-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-slate-100">
            Wi-Fi Sensing Monitor
          </h1>
          <p className="font-mono text-[10px] text-slate-600">
            Passive human presence & movement detection via RF channel state
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-1.5 sm:flex">
            <span
              className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-400" : "bg-red-400"}`}
            />
            <span className="font-mono text-[10px] text-slate-500">
              {connected ? "WebSocket Connected" : "Reconnecting..."}
            </span>
          </div>
        </div>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-hidden p-3 lg:grid-cols-[1fr_320px] lg:grid-rows-[1fr_auto]">
        <div className="relative min-h-[300px] lg:row-span-2">
          <RoomVisualization
            room={currentRoom}
            personX={displayX}
            personY={displayY}
            personVisible={personVisible && !isCalibrating}
            personMoving={personMoving}
            direction={reading?.direction ?? null}
            trails={trails}
            heatmap={heatmap}
            movementDetected={personMoving}
          />
          <CalibrationOverlay
            remaining={reading?.calibration_remaining_sec ?? null}
            roomStatus={roomStatus}
          />
        </div>

        <div className="flex flex-col gap-3 overflow-y-auto">
          <StatusPanel
            roomStatus={roomStatus}
            presenceProbability={reading?.presence_probability ?? 0}
            movementProbability={reading?.movement_probability ?? 0}
            timestamp={reading?.timestamp ?? null}
            connected={connected}
          />
          <MovementMeter
            intensity={reading?.movement_intensity ?? 0}
            velocity={reading?.velocity ?? 0}
            direction={reading?.direction ?? null}
          />
          <ConfigPanel room={currentRoom} onUpdate={sendConfig} />
        </div>

        <div className="grid min-h-[180px] grid-cols-1 gap-3 sm:grid-cols-2 lg:col-span-1">
          <SignalGraph data={rssiHistory} />
          <WaveformChart waveform={reading?.csi_waveform ?? []} />
        </div>
      </main>

      <footer className="border-t border-slate-800/50 px-6 py-2">
        <p className="text-center font-mono text-[10px] leading-relaxed text-slate-600">
          Disclaimer: Person location shown is an estimate derived from Wi-Fi
          channel state information (CSI) and RSSI measurements. This is not a
          camera image and does not guarantee exact positioning.
        </p>
      </footer>
    </div>
  );
}
