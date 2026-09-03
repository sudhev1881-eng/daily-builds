export type AlarmStatus = "OFF" | "ARMED" | "RINGING" | "CHALLENGE" | "DEFEATED";

export type ArmPhase = "idle" | "press" | "dim" | "expand" | "done";

export type ScreenFx = "none" | "dim" | "shake" | "pulse" | "celebrate";

export type FakeKind = "stop" | "really" | "actually";

export type BubbleStyle = "speech" | "toast" | "float" | "npc" | "emoji";

export interface AlarmStats {
  chaseMs: number;
  questionsAnswered: number;
  wrongAnswers: number;
  longestStreak: number;
  buttonEscapes: number;
  fakeClicks: number;
}

export const STREAK_GOAL = 5;
export const BASE_TIMER_MS = 3 * 60 * 1000;
export const PENALTY_MS = 2 * 60 * 1000;
export const PANIC_MS = 30 * 1000;
export const FAKE_AFTER_MS = 18_000;
export const RESULT_BEAT_MS = 760;
