import { useCallback, useEffect, useRef, useState } from "react";
import type { ProcessedReading, RoomConfig } from "../types/sensor";

const WS_URL =
  import.meta.env.VITE_WS_URL ||
  `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.hostname}:8000/ws`;

interface UseWebSocketReturn {
  reading: ProcessedReading | null;
  connected: boolean;
  simulationMode: boolean;
  room: RoomConfig | null;
  sendConfig: (config: RoomConfig) => void;
}

export function useWebSocket(): UseWebSocketReturn {
  const [reading, setReading] = useState<ProcessedReading | null>(null);
  const [connected, setConnected] = useState(false);
  const [simulationMode, setSimulationMode] = useState(true);
  const [room, setRoom] = useState<RoomConfig | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);

    ws.onclose = () => {
      setConnected(false);
      reconnectTimer.current = setTimeout(connect, 2000);
    };

    ws.onerror = () => ws.close();

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === "init") {
        setSimulationMode(data.simulation_mode);
        setRoom(data.room);
        return;
      }

      if (data.type === "config_update") {
        setRoom(data.room);
        return;
      }

      setReading(data as ProcessedReading);
      if (data.simulation_mode !== undefined) {
        setSimulationMode(data.simulation_mode);
      }
      if (data.room) {
        setRoom(data.room);
      }
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const sendConfig = useCallback((config: RoomConfig) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({ type: "config_update", room: config })
      );
    }
    setRoom(config);
  }, []);

  return { reading, connected, simulationMode, room, sendConfig };
}
