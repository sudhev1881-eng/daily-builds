export type DetectionStatus =
  | "No Person Detected"
  | "Person Detected"
  | "Movement Detected";

export interface SensorPosition {
  x: number;
  y: number;
}

export interface RoomConfig {
  width: number;
  height: number;
  router: SensorPosition;
  receiver: SensorPosition;
}

export interface ProcessedReading {
  timestamp: string;
  rssi: number;
  presence_probability: number;
  movement_probability: number;
  movement_intensity: number;
  x: number;
  y: number;
  velocity: number;
  direction: number | null;
  status: DetectionStatus;
  csi_waveform: number[];
  simulation_mode: boolean;
  room: RoomConfig;
}

export interface TrailPoint {
  x: number;
  y: number;
  timestamp: number;
  intensity: number;
}

export interface HeatmapCell {
  x: number;
  y: number;
  intensity: number;
}
