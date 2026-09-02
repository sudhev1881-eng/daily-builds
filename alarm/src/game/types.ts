export type AlarmStatus = "OFF" | "ARMED" | "RINGING" | "CHALLENGE" | "DEFEATED";

export type FakeKind = "stop" | "really" | "actually";

export interface AlarmStats {
  chaseMs: number;
  questionsAnswered: number;
  wrongAnswers: number;
  longestStreak: number;
  buttonEscapes: number;
  fakeClicks: number;
}

export interface Bubble {
  id: number;
  text: string;
  x: number;
  y: number;
  follow?: boolean;
}

export const STREAK_GOAL = 5;
export const BASE_TIMER_MS = 3 * 60 * 1000;
export const PENALTY_MS = 2 * 60 * 1000;
export const PANIC_MS = 30 * 1000;
export const FAKE_AFTER_MS = 18_000;
