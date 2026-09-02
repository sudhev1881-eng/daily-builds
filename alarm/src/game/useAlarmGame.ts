import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { alarmAudio } from "../audio/AlarmAudio";
import { nextQuestion, type QuizQuestion } from "../data/questions";
import { pick, TRICK_REVEAL, WRONG_BAIT } from "../data/ragebait";
import { useNow } from "../hooks/useNow";
import {
  BASE_TIMER_MS,
  PENALTY_MS,
  STREAK_GOAL,
  type AlarmStats,
  type AlarmStatus,
} from "./types";

export function useAlarmGame() {
  const now = useNow(50);
  const [status, setStatus] = useState<AlarmStatus>("OFF");
  const [hour, setHour] = useState(7);
  const [minute, setMinute] = useState(30);
  const [alarmAt, setAlarmAt] = useState<number | null>(null);
  const [arming, setArming] = useState(false);
  const [volume, setVolume] = useState(0.55);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [screenFx, setScreenFx] = useState<"none" | "dim" | "shake" | "pulse">("none");
  const [timerEnd, setTimerEnd] = useState<number | null>(null);
  const [streak, setStreak] = useState(0);
  const [question, setQuestion] = useState<QuizQuestion | null>(null);
  const [asked, setAsked] = useState<string[]>([]);
  const [lockAnswers, setLockAnswers] = useState(false);
  const [lastResult, setLastResult] = useState<"correct" | "wrong" | null>(null);
  const [revealTrick, setRevealTrick] = useState(false);
  const [baitLine, setBaitLine] = useState<string | null>(null);
  const [soClose, setSoClose] = useState(false);
  const [beat, setBeat] = useState(0);
  const chaseStarted = useRef<number | null>(null);
  const [stats, setStats] = useState<AlarmStats>({
    chaseMs: 0,
    questionsAnswered: 0,
    wrongAnswers: 0,
    longestStreak: 0,
    buttonEscapes: 0,
    fakeClicks: 0,
  });

  useEffect(() => {
    alarmAudio.setVolume(volume);
  }, [volume]);

  useEffect(() => {
    alarmAudio.setOnBeat((t) => setBeat(t));
    return () => alarmAudio.setOnBeat(null);
  }, []);

  const remainingToAlarm = useMemo(() => {
    if (!alarmAt || status !== "ARMED") return 0;
    return Math.max(0, alarmAt - now);
  }, [alarmAt, now, status]);

  const timerLeft = timerEnd ? Math.max(0, timerEnd - now) : 0;
  const panic = status === "RINGING" && timerLeft > 0 && timerLeft <= 30_000;

  useEffect(() => {
    if (status === "ARMED" && alarmAt && now >= alarmAt) {
      setStatus("RINGING");
      setTimerEnd(Date.now() + BASE_TIMER_MS);
      chaseStarted.current = Date.now();
      alarmAudio.start();
      setScreenFx("pulse");
    }
  }, [status, alarmAt, now]);

  const computeAlarmAt = useCallback(
    (h: number, m: number, delayMs?: number) => {
      if (delayMs !== undefined) return Date.now() + delayMs;
      const d = new Date();
      d.setSeconds(0, 0);
      d.setHours(h, m, 0, 0);
      if (d.getTime() <= Date.now() + 1500) d.setDate(d.getDate() + 1);
      return d.getTime();
    },
    [],
  );

  const setAlarm = useCallback(
    (opts?: { delayMs?: number }) => {
      if (arming || status !== "OFF") return;
      setArming(true);
      setScreenFx("dim");
      alarmAudio.tap();
      window.setTimeout(() => {
        const at = computeAlarmAt(hour, minute, opts?.delayMs);
        setAlarmAt(at);
        setStatus("ARMED");
        setArming(false);
        setScreenFx("pulse");
        window.setTimeout(() => setScreenFx("none"), 700);
      }, 720);
    },
    [arming, status, hour, minute, computeAlarmAt],
  );

  const disarm = useCallback(() => {
    if (status !== "ARMED") return;
    setStatus("OFF");
    setAlarmAt(null);
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
    setRevealTrick(false);
    alarmAudio.tap();
  }, [status]);

  const noteEscape = useCallback(() => {
    setStats((s) => ({ ...s, buttonEscapes: s.buttonEscapes + 1 }));
    setSoClose(true);
    window.setTimeout(() => setSoClose(false), 520);
  }, []);

  const noteFake = useCallback(() => {
    setStats((s) => ({ ...s, fakeClicks: s.fakeClicks + 1 }));
    alarmAudio.fail();
  }, []);

  const answer = useCallback(
    (index: number) => {
      if (!question || lockAnswers || status !== "CHALLENGE") return;
      setLockAnswers(true);
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
        window.setTimeout(() => {
          if (nextStreak >= STREAK_GOAL) {
            alarmAudio.stop();
            setStatus("DEFEATED");
            setScreenFx("none");
            setLockAnswers(false);
            setRevealTrick(false);
            return;
          }
          const ids = [...asked, question.id];
          setAsked(ids);
          setQuestion(nextQuestion(ids));
          setLastResult(null);
          setRevealTrick(false);
          setBaitLine(null);
          setLockAnswers(false);
        }, 780);
      } else {
        alarmAudio.fail();
        setLastResult("wrong");
        setStreak(0);
        setBaitLine(pick(WRONG_BAIT));
        setScreenFx("shake");
        setTimerEnd((end) => (end ?? Date.now()) + PENALTY_MS);
        window.setTimeout(() => {
          setScreenFx("none");
          const ids = [...asked, question.id];
          setAsked(ids);
          setQuestion(nextQuestion(ids));
          setLastResult(null);
          setBaitLine(null);
          setLockAnswers(false);
        }, 800);
      }
    },
    [question, lockAnswers, status, streak, asked],
  );

  const reset = useCallback(() => {
    alarmAudio.stop();
    setStatus("OFF");
    setAlarmAt(null);
    setArming(false);
    setTimerEnd(null);
    setStreak(0);
    setQuestion(null);
    setAsked([]);
    setLockAnswers(false);
    setLastResult(null);
    setRevealTrick(false);
    setBaitLine(null);
    setScreenFx("none");
    chaseStarted.current = null;
    setStats({
      chaseMs: 0,
      questionsAnswered: 0,
      wrongAnswers: 0,
      longestStreak: 0,
      buttonEscapes: 0,
      fakeClicks: 0,
    });
  }, []);

  return {
    now,
    status,
    hour,
    minute,
    setHour,
    setMinute,
    alarmAt,
    arming,
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
    revealTrick,
    baitLine,
    soClose,
    beat,
    stats,
    setAlarm,
    disarm,
    caughtStop,
    noteEscape,
    noteFake,
    answer,
    reset,
  };
}

export type AlarmGame = ReturnType<typeof useAlarmGame>;
