export type DetectionStatus =
  | "No Person Detected"
  | "Person Detected"
  | "Movement Detected";

export type RoomStatus =
  | "BOOTING"
  | "BASELINE ESTABLISHED"
  | "ROOM EMPTY"
  | "OCCUPIED — STATIONARY"
  | "HUMAN MOVING"
  | "ENVIRONMENTAL ACTIVITY"
  | "ENVIRONMENTAL CHANGE DETECTED"
  | "NOISE / IGNORE";

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
  room_status: RoomStatus;
  person_visible: boolean;
  calibration_remaining_sec: number | null;
  position_error_m: number | null;
  accuracy_radius_m: number;
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

// Thresholds mirrored from backend defaults for frontend gating
export const TRAIL_MIN_DISTANCE_M = 0.25;
export const HEATMAP_MIN_PRESENCE = 0.65;
export const HEATMAP_MIN_MOVEMENT = 0.65;
