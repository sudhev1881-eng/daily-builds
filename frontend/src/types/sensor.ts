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

export interface TrackedPerson {
  id: number;
  x: number;
  y: number;
  moving: boolean;
  velocity: number;
  direction: number | null;
  is_user: boolean;
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
  people: TrackedPerson[];
  person_count: number;
  calibration_remaining_sec: number | null;
  calibration_quality: number | null;
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
  personId: number;
  isUser: boolean;
}

// Distinct marker colors per tracked person id
export const PERSON_COLORS = [
  { main: "#34d399", still: "#6ee7b7", glow: "52,211,153" },
  { main: "#38bdf8", still: "#7dd3fc", glow: "56,189,248" },
  { main: "#fbbf24", still: "#fcd34d", glow: "251,191,36" },
] as const;

// The user-controlled person is always rose
export const USER_COLOR = { main: "#f472b6", still: "#f9a8d4", glow: "244,114,182" } as const;

export function personColor(id: number, isUser = false) {
  if (isUser) return USER_COLOR;
  return PERSON_COLORS[id % PERSON_COLORS.length];
}

export function personLabel(p: TrackedPerson): string {
  return p.is_user ? "YOU" : `P${p.id + 1}`;
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
