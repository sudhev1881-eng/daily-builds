import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { alarmAudio } from "../audio/AlarmAudio";
import { nextQuestion, type QuizQuestion } from "../data/questions";
import { pick, TRICK_REVEAL, WRONG_BAIT } from "../data/ragebait";
import { useNow } from "../hooks/useNow";
import {
  BASE_TIMER_MS,
  PENALTY_MS,
  RESULT_BEAT_MS,
  STREAK_GOAL,
  type AlarmStats,
  type AlarmStatus,
  type ArmPhase,
  type ScreenFx,
} from "./types";

const emptyStats = (): AlarmStats => ({
  chaseMs: 0,
  questionsAnswered: 0,
  wrongAnswers: 0,
  longestStreak: 0,
  buttonEscapes: 0,
  fakeClicks: 0,
});

export function useAlarmGame() {
  const now = useNow(40);
  const [status, setStatus] = useState<AlarmStatus>("OFF");
  const [hour, setHour] = useState(7);
  const [minute, setMinute] = useState(30);
  const [alarmAt, setAlarmAt] = useState<number | null>(null);
  const [armPhase, setArmPhase] = useState<ArmPhase>("idle");
  const [volume, setVolume] = useState(0.55);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [screenFx, setScreenFx] = useState<ScreenFx>("none");
  const [timerEnd, setTimerEnd] = useState<number | null>(null);
  const [streak, setStreak] = useState(0);
  const [question, setQuestion] = useState<QuizQuestion | null>(null);
  const [asked, setAsked] = useState<string[]>([]);
  const [lockAnswers, setLockAnswers] = useState(false);
  const [lastResult, setLastResult] = useState<"correct" | "wrong" | null>(null);
  const [pickedIndex, setPickedIndex] = useState<number | null>(null);
  const [revealTrick, setRevealTrick] = useState(false);
  const [baitLine, setBaitLine] = useState<string | null>(null);
  const [soClose, setSoClose] = useState(false);
  const [beat, setBeat] = useState(0);
  const [ringIntro, setRingIntro] = useState(false);
  const [penaltyFlash, setPenaltyFlash] = useState(false);
  const chaseStarted = useRef<number | null>(null);
  const timers = useRef<number[]>([]);
  const [stats, setStats] = useState<AlarmStats>(emptyStats);

  const later = useCallback((ms: number, fn: () => void) => {
    const id = window.setTimeout(fn, ms);
    timers.current.push(id);
    return id;
  }, []);

  const clearTimers = useCallback(() => {
    for (const id of timers.current) window.clearTimeout(id);
    timers.current = [];
  }, []);

  useEffect(() => {
    alarmAudio.setVolume(volume);
  }, [volume]);

  useEffect(() => {
    alarmAudio.setOnBeat((t) => setBeat(t));
    return () => {
      alarmAudio.setOnBeat(null);
      alarmAudio.stop();
      clearTimers();
    };
  }, [clearTimers]);

  const remainingToAlarm = useMemo(() => {
    if (!alarmAt || status !== "ARMED") return 0;
    return Math.max(0, alarmAt - now);
  }, [alarmAt, now, status]);

  const timerLeft = timerEnd ? Math.max(0, timerEnd - now) : 0;
  const panic = status === "RINGING" && timerLeft > 0 && timerLeft <= 30_000;
  const arming = armPhase === "press" || armPhase === "dim" || armPhase === "expand";

  useEffect(() => {
    if (status === "ARMED" && alarmAt && now >= alarmAt) {
      setStatus("RINGING");
      setTimerEnd(Date.now() + BASE_TIMER_MS);
      chaseStarted.current = Date.now();
      alarmAudio.start();
      setRingIntro(true);
      setScreenFx("shake");
      later(480, () => setScreenFx("pulse"));
      later(1400, () => {
        setRingIntro(false);
        setScreenFx("none");
      });
    }
  }, [status, alarmAt, now, later]);

  const computeAlarmAt = useCallback((h: number, m: number, delayMs?: number) => {
    if (delayMs !== undefined) return Date.now() + delayMs;
    const d = new Date();
    d.setSeconds(0, 0);
    d.setHours(h, m, 0, 0);
    if (d.getTime() <= Date.now() + 1500) d.setDate(d.getDate() + 1);
    return d.getTime();
  }, []);

  const setAlarm = useCallback(
    (opts?: { delayMs?: number }) => {
      if (arming || status !== "OFF") return;
      clearTimers();
      setArmPhase("press");
      setScreenFx("dim");
      alarmAudio.tap();
      later(180, () => setArmPhase("dim"));
      later(520, () => {
        const at = computeAlarmAt(hour, minute, opts?.delayMs);
        setAlarmAt(at);
        setStatus("ARMED");
        setArmPhase("expand");
        setScreenFx("pulse");
        alarmAudio.arm();
      });
      later(1200, () => {
        setArmPhase("done");
        setScreenFx("none");
      });
    },
    [arming, status, hour, minute, computeAlarmAt, later, clearTimers],
  );

  const disarm = useCallback(() => {
    if (status !== "ARMED") return;
    setStatus("OFF");
    setAlarmAt(null);
    setArmPhase("idle");
    setScreenFx("none");
  }, [status]);

  const caughtStop = useCallback(() => {
    if (status !== "RINGING") return;
    const started = chaseStarted.current ?? Date.now();
    setStats((s) => ({ ...s, chaseMs: Date.now() - started }));
    setStatus("CHALLENGE");
    setQuestion(nextQuestion([]));
    setAsked([]);
    setStreak(0);
    setLastResult(null);
    setPickedIndex(null);
    setRevealTrick(false);
    setRingIntro(false);
    alarmAudio.tap();
  }, [status]);

  const noteEscape = useCallback(() => {
    setStats((s) => ({ ...s, buttonEscapes: s.buttonEscapes + 1 }));
    setSoClose(true);
    later(520, () => setSoClose(false));
  }, [later]);

  const noteFake = useCallback(() => {
    setStats((s) => ({ ...s, fakeClicks: s.fakeClicks + 1 }));
    alarmAudio.fail();
  }, []);

  const answer = useCallback(
    (index: number) => {
      if (!question || lockAnswers || status !== "CHALLENGE") return;
      setLockAnswers(true);
      setPickedIndex(index);
      const correct = index === question.correctIndex;
      setStats((s) => ({
        ...s,
        questionsAnswered: s.questionsAnswered + 1,
        wrongAnswers: s.wrongAnswers + (correct ? 0 : 1),
      }));

      if (correct) {
        alarmAudio.success();
        setLastResult("correct");
        const nextStreak = streak + 1;
        setStreak(nextStreak);
        setStats((s) => ({
          ...s,
          longestStreak: Math.max(s.longestStreak, nextStreak),
        }));
        if (question.trick) {
          setRevealTrick(true);
          setBaitLine(pick(TRICK_REVEAL));
        }
        later(RESULT_BEAT_MS, () => {
          if (nextStreak >= STREAK_GOAL) {
            alarmAudio.stop();
            alarmAudio.win();
            setStatus("DEFEATED");
            setScreenFx("celebrate");
            setLockAnswers(false);
            setRevealTrick(false);
            setPickedIndex(null);
            return;
          }
          const ids = [...asked, question.id];
          setAsked(ids);
          setQuestion(nextQuestion(ids));
          setLastResult(null);
          setRevealTrick(false);
          setBaitLine(null);
          setPickedIndex(null);
          setLockAnswers(false);
        });
      } else {
        alarmAudio.fail();
        setLastResult("wrong");
        setStreak(0);
        setBaitLine(pick(WRONG_BAIT));
        setScreenFx("shake");
        setPenaltyFlash(true);
        setTimerEnd((end) => (end ?? Date.now()) + PENALTY_MS);
        later(RESULT_BEAT_MS, () => {
          setScreenFx("none");
          setPenaltyFlash(false);
          const ids = [...asked, question.id];
          setAsked(ids);
          setQuestion(nextQuestion(ids));
          setLastResult(null);
          setBaitLine(null);
          setPickedIndex(null);
          setLockAnswers(false);
        });
      }
    },
    [question, lockAnswers, status, streak, asked, later],
  );

  const applyDemo = useCallback((mode: string) => {
    if (mode === "armed") {
      setAlarmAt(Date.now() + 8 * 60 * 1000);
      setStatus("ARMED");
      setArmPhase("done");
      return;
    }
    if (mode === "armed-soon") {
      setAlarmAt(Date.now() + 95_000);
      setStatus("ARMED");
      setArmPhase("done");
      return;
    }
    if (mode === "ring") {
      setStatus("RINGING");
      setTimerEnd(Date.now() + 45_000);
      chaseStarted.current = Date.now();
      alarmAudio.start();
      setRingIntro(true);
      later(1200, () => setRingIntro(false));
      return;
    }
    if (mode === "panic") {
      setStatus("RINGING");
      setTimerEnd(Date.now() + 22_000);
      chaseStarted.current = Date.now();
      alarmAudio.start();
      return;
    }
    if (mode === "challenge") {
      setStatus("CHALLENGE");
      setTimerEnd(Date.now() + 120_000);
      setQuestion(nextQuestion([]));
      return;
    }
    if (mode === "win") {
      alarmAudio.stop();
      setStatus("DEFEATED");
      setScreenFx("celebrate");
      setStats({
        chaseMs: 18400,
        questionsAnswered: 7,
        wrongAnswers: 2,
        longestStreak: 5,
        buttonEscapes: 6,
        fakeClicks: 2,
      });
    }
  }, [later]);

  const reset = useCallback(() => {
    alarmAudio.stop();
    clearTimers();
    setStatus("OFF");
    setAlarmAt(null);
    setArmPhase("idle");
    setTimerEnd(null);
    setStreak(0);
    setQuestion(null);
    setAsked([]);
    setLockAnswers(false);
    setLastResult(null);
    setPickedIndex(null);
    setRevealTrick(false);
    setBaitLine(null);
    setScreenFx("none");
    setRingIntro(false);
    setPenaltyFlash(false);
    chaseStarted.current = null;
    setStats(emptyStats());
  }, [clearTimers]);

  return {
    now,
    status,
    hour,
    minute,
    setHour,
    setMinute,
    alarmAt,
    arming,
    armPhase,
    volume,
    setVolume,
    settingsOpen,
    setSettingsOpen,
    screenFx,
    remainingToAlarm,
    timerLeft,
    panic,
    streak,
    question,
    lockAnswers,
    lastResult,
    pickedIndex,
    revealTrick,
    baitLine,
    soClose,
    beat,
    ringIntro,
    penaltyFlash,
    stats,
    setAlarm,
    disarm,
    caughtStop,
    noteEscape,
    noteFake,
    answer,
    reset,
    applyDemo,
  };
}

export type AlarmGame = ReturnType<typeof useAlarmGame>;
