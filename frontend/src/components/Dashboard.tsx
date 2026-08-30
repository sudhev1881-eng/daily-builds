import { useCallback, useEffect, useRef, useState } from "react";
import { API_URL } from "../config";
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
  const lastTrailPos = useRef<Map<number, { x: number; y: number }>>(new Map());

  const currentRoom = room || reading?.room || DEFAULT_ROOM;
  const roomStatus: RoomStatus = reading?.room_status ?? "BOOTING";
  const isCalibrating =
    roomStatus === "BOOTING" || roomStatus === "BASELINE ESTABLISHED";
  const personVisible = reading?.person_visible ?? false;
  const personMoving = roomStatus === "HUMAN MOVING";
  const people = personVisible && !isCalibrating ? (reading?.people ?? []) : [];
  const personCount = reading?.person_count ?? 0;
  const userInRoom = people.some((p) => p.is_user);

  const enterRoom = useCallback(() => {
    fetch(`${API_URL}/user/enter`, { method: "POST" }).catch(() => {});
  }, []);

  const leaveRoom = useCallback(() => {
    fetch(`${API_URL}/user/leave`, { method: "POST" }).catch(() => {});
  }, []);

  const walkTo = useCallback((x: number, y: number) => {
    fetch(`${API_URL}/user/move`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ x, y }),
    }).catch(() => {});
  }, []);

  const recalibrate = useCallback(() => {
    fetch(`${API_URL}/calibrate`, { method: "POST" }).catch(() => {});
  }, []);

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
      const newPoints: TrailPoint[] = [];
      for (const person of reading.people) {
        if (!person.moving) continue;
        const last = lastTrailPos.current.get(person.id);
        const dist = last
          ? Math.hypot(person.x - last.x, person.y - last.y)
          : TRAIL_MIN_DISTANCE_M;

        if (dist >= TRAIL_MIN_DISTANCE_M) {
          lastTrailPos.current.set(person.id, { x: person.x, y: person.y });
          newPoints.push({
            x: person.x,
            y: person.y,
            timestamp: Date.now(),
            intensity: reading.movement_intensity / 100,
            personId: person.id,
            isUser: person.is_user,
          });

          const cellX = Math.round(person.x * 2) / 2;
          const cellY = Math.round(person.y * 2) / 2;
          const key = `${cellX},${cellY}`;
          const current = heatmapRef.current.get(key) || 0;
          heatmapRef.current.set(
            key,
            Math.min(1, current + reading.movement_intensity / 300)
          );
        }
      }
      if (newPoints.length > 0) {
        setTrails((prev) => [...prev.slice(-150), ...newPoints]);
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
    <div className="flex min-h-0 flex-1 flex-col">
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

      <main className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-3 lg:flex-row">
        {/* Left column: room + charts */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
          <div className="relative min-h-[280px] flex-1">
            <RoomVisualization
              room={currentRoom}
              people={people}
              trails={trails}
              heatmap={heatmap}
              movementDetected={personMoving}
              accuracyRadius={reading?.accuracy_radius_m ?? 0.5}
              clickToWalk={userInRoom}
              onRoomClick={walkTo}
            />
            <div className="absolute top-2 right-2 z-10 flex gap-2">
              {!isCalibrating && (
                <button
                  onClick={userInRoom ? leaveRoom : enterRoom}
                  className={`rounded-md px-3 py-1.5 font-mono text-[11px] font-semibold transition-colors ${
                    userInRoom
                      ? "bg-pink-500/20 text-pink-300 hover:bg-pink-500/30"
                      : "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"
                  }`}
                >
                  {userInRoom ? "Leave Room" : "Enter Room"}
                </button>
              )}
              <button
                onClick={recalibrate}
                disabled={isCalibrating}
                className="rounded-md bg-sky-500/20 px-3 py-1.5 font-mono text-[11px] font-semibold text-sky-300 transition-colors hover:bg-sky-500/30 disabled:opacity-40"
              >
                Recalibrate
              </button>
            </div>
            <CalibrationOverlay
              remaining={reading?.calibration_remaining_sec ?? null}
              roomStatus={roomStatus}
            />
          </div>

          <div className="grid h-[160px] shrink-0 grid-cols-1 gap-3 sm:grid-cols-2">
            <SignalGraph data={rssiHistory} />
            <WaveformChart waveform={reading?.csi_waveform ?? []} />
          </div>
        </div>

        {/* Right sidebar */}
        <aside className="flex max-h-[40vh] shrink-0 flex-col gap-3 overflow-y-auto lg:max-h-none lg:w-80">
          <StatusPanel
            roomStatus={roomStatus}
            presenceProbability={reading?.presence_probability ?? 0}
            movementProbability={reading?.movement_probability ?? 0}
            personCount={personCount}
            people={people}
            timestamp={reading?.timestamp ?? null}
            connected={connected}
            positionError={reading?.position_error_m ?? null}
            accuracyRadius={reading?.accuracy_radius_m ?? 0.5}
            calibrationQuality={reading?.calibration_quality ?? null}
            simulationMode={simulationMode}
          />
          <MovementMeter
            intensity={reading?.movement_intensity ?? 0}
            velocity={reading?.velocity ?? 0}
            direction={reading?.direction ?? null}
          />
          <ConfigPanel room={currentRoom} onUpdate={sendConfig} />
        </aside>
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
