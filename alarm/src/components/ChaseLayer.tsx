import { useEffect, useRef, useState, type RefObject } from "react";
import { CHASE_BAIT, FAKE_BAIT, pick, pickStyle } from "../data/ragebait";
import type { AlarmGame } from "../game/useAlarmGame";
import { FAKE_AFTER_MS, type BubbleStyle, type FakeKind } from "../game/types";
import type { PointerState } from "../hooks/usePointer";
import { RageBubble } from "./RageBubble";

interface Props {
  game: AlarmGame;
  pointer: RefObject<PointerState>;
}

const BTN_W = 172;
const BTN_H = 58;

interface FakeBtn {
  id: number;
  kind: FakeKind;
  x: number;
  y: number;
}

interface BubbleState {
  text: string;
  styleKind: BubbleStyle;
  life: number;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function ChaseLayer({ game, pointer }: Props) {
  const pos = useRef({ x: window.innerWidth / 2 - BTN_W / 2, y: window.innerHeight * 0.62 });
  const vel = useRef({ x: 0, y: 0 });
  const [render, setRender] = useState({ ...pos.current });
  const [bubble, setBubble] = useState<BubbleState | null>(null);
  const [fakes, setFakes] = useState<FakeBtn[]>([]);
  const [freeze, setFreeze] = useState<string | null>(null);
  const hesitated = useRef(false);
  const hesitating = useRef(false);
  const lastEscape = useRef(0);
  const lastJump = useRef(0);
  const started = useRef(performance.now());
  const fakeStage = useRef(0);
  const noteEscape = useRef(game.noteEscape);
  const panicRef = useRef(game.panic);
  const caught = useRef(game.caughtStop);
  noteEscape.current = game.noteEscape;
  panicRef.current = game.panic;
  caught.current = game.caughtStop;

  useEffect(() => {
    if (!bubble) return;
    const wait = Math.max(0, bubble.life - performance.now());
    const id = window.setTimeout(() => setBubble(null), wait);
    return () => window.clearTimeout(id);
  }, [bubble]);

  useEffect(() => {
    started.current = performance.now();
    pos.current = {
      x: window.innerWidth / 2 - BTN_W / 2,
      y: window.innerHeight * 0.58,
    };
    hesitated.current = false;
    fakeStage.current = 0;
    setFakes([]);
  }, []);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const p = pointer.current;
      const panic = panicRef.current;
      const pad = 12;
      const maxX = window.innerWidth - BTN_W - pad;
      const maxY = window.innerHeight - BTN_H - pad;
      const cx = pos.current.x + BTN_W / 2;
      const cy = pos.current.y + BTN_H / 2;
      const dx = cx - p.x;
      const dy = cy - p.y;
      const dist = Math.hypot(dx, dy);
      const coarse = p.coarse;
      const danger = panic ? (coarse ? 128 : 168) : coarse ? 92 : 118;

      if (p.active && dist < danger && !hesitating.current) {
        if (!hesitated.current && dist < danger * 0.78) {
          hesitated.current = true;
          hesitating.current = true;
          setBubble({
            text: pick(CHASE_BAIT),
            styleKind: pickStyle(),
            life: performance.now() + 920,
          });
          window.setTimeout(
            () => {
              hesitating.current = false;
              const ang = Math.atan2(dy || 1, dx || 1);
              const burst = panic ? 32 : 20;
              vel.current.x += Math.cos(ang) * burst;
              vel.current.y += Math.sin(ang) * burst;
              noteEscape.current();
              lastEscape.current = performance.now();
            },
            panic ? 140 : 360,
          );
        } else if (!hesitating.current) {
          const fromLeft = p.x < cx || p.vx > 0.12;
          const fromRight = p.x > cx || p.vx < -0.12;
          const fromTop = p.y < cy || p.vy > 0.12;
          let ox = fromLeft ? 1 : fromRight ? -1 : dx >= 0 ? 1 : -1;
          let oy = fromTop ? 1 : -1;
          if (Math.abs(dx) > Math.abs(dy)) oy *= 0.42;
          else ox *= 0.42;
          const force = (danger - dist) / danger;
          const mag = panic ? 5.1 : coarse ? 2.1 : 2.7;
          vel.current.x += ox * force * mag;
          vel.current.y += oy * force * mag;
          if (dist < 50 && performance.now() - lastEscape.current > 400) {
            noteEscape.current();
            lastEscape.current = performance.now();
            setBubble({
              text: pick(CHASE_BAIT),
              styleKind: pickStyle(),
              life: performance.now() + 720,
            });
          }
        }
      }

      if (coarse && p.active && dist < 140 && performance.now() - lastJump.current > 3500) {
        lastJump.current = performance.now();
        const nx = clamp(Math.random() * maxX, pad, maxX);
        const ny = clamp(80 + Math.random() * (maxY - 80), pad + 48, maxY);
        pos.current.x = nx;
        pos.current.y = ny;
        vel.current.x = 0;
        vel.current.y = 0;
        noteEscape.current();
        setBubble({
          text: pick(CHASE_BAIT),
          styleKind: "toast",
          life: performance.now() + 700,
        });
      }

      if (!hesitating.current) {
        pos.current.x += vel.current.x;
        pos.current.y += vel.current.y;
      }
      vel.current.x *= panic ? 0.82 : 0.86;
      vel.current.y *= panic ? 0.82 : 0.86;

      if (pos.current.x < pad) {
        pos.current.x = pad;
        vel.current.x = Math.abs(vel.current.x) + 5;
      }
      if (pos.current.y < pad + 48) {
        pos.current.y = pad + 48;
        vel.current.y = Math.abs(vel.current.y) + 5;
      }
      if (pos.current.x > maxX) {
        pos.current.x = maxX;
        vel.current.x = -Math.abs(vel.current.x) - 5;
      }
      if (pos.current.y > maxY) {
        pos.current.y = maxY;
        vel.current.y = -Math.abs(vel.current.y) - 5;
      }

      setRender({ x: pos.current.x, y: pos.current.y });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [pointer]);

  useEffect(() => {
    const id = window.setInterval(() => {
      const elapsed = performance.now() - started.current;
      if (fakeStage.current === 0 && elapsed > FAKE_AFTER_MS) {
        fakeStage.current = 1;
        setFakes([
          {
            id: 1,
            kind: "stop",
            x: window.innerWidth / 2 - BTN_W / 2,
            y: window.innerHeight - 130,
          },
        ]);
      }
      if (game.panic && fakeStage.current < 5 && Math.random() < 0.42) {
        fakeStage.current += 1;
        setFakes((prev) => [
          ...prev.slice(-4),
          {
            id: Date.now(),
            kind: Math.random() < 0.2 ? "actually" : "stop",
            x: 20 + Math.random() * (window.innerWidth - BTN_W - 40),
            y: 80 + Math.random() * (window.innerHeight - 180),
          },
        ]);
      }
    }, 850);
    return () => window.clearInterval(id);
  }, [game.panic]);

  const clickFake = (btn: FakeBtn) => {
    game.noteFake();
    const line =
      btn.kind === "stop"
        ? pick(FAKE_BAIT)
        : btn.kind === "really"
          ? "ഇത്ര പെട്ടെന്ന് വിശ്വസിച്ചോ? 😭"
          : "ഇത് ആണ് ശരിയെന്ന് തോന്നിയോ? 🥲";
    setFreeze(line);
    window.setTimeout(() => {
      setFreeze(null);
      if (btn.kind === "stop") {
        setFakes([
          {
            id: Date.now(),
            kind: "really",
            x: clamp(btn.x, 16, window.innerWidth - BTN_W - 16),
            y: clamp(btn.y - 90, 80, window.innerHeight - 140),
          },
        ]);
      } else if (btn.kind === "really") {
        setFakes([
          {
            id: Date.now(),
            kind: "actually",
            x: window.innerWidth / 2 - BTN_W / 2,
            y: window.innerHeight * 0.34,
          },
        ]);
      } else {
        setFakes([]);
      }
    }, 520);
  };

  const labelFor = (kind: FakeKind) =>
    kind === "stop" ? "STOP ALARM" : kind === "really" ? "REALLY STOP" : "THIS ONE ACTUALLY WORKS";

  return (
    <>
      {game.panic && (
        <div className="pointer-events-none fixed top-16 left-1/2 z-20 -translate-x-1/2 rounded-full bg-red-600 px-4 py-1 text-xs font-black tracking-[0.25em] text-white shadow-[0_0_24px_rgba(255,40,60,0.7)]">
          PANIC MODE
        </div>
      )}

      {fakes.map((f) => (
        <button
          key={f.id}
          type="button"
          className="interactive-btn fixed z-[25] rounded-2xl bg-rose-500 px-5 py-3 text-sm font-black text-white shadow-lg"
          style={{ left: f.x, top: f.y, width: BTN_W }}
          onClick={() => clickFake(f)}
        >
          {labelFor(f.kind)}
        </button>
      ))}

      <button
        type="button"
        className="interactive-btn fixed z-30 rounded-2xl bg-gradient-to-r from-rose-500 to-orange-400 px-5 py-3 text-sm font-black tracking-wide text-white shadow-[0_10px_28px_rgba(255,40,80,0.45)]"
        style={{
          left: render.x,
          top: render.y,
          width: BTN_W,
          height: BTN_H,
        }}
        aria-label="Stop alarm"
        onPointerDown={(e) => {
          e.stopPropagation();
          caught.current();
        }}
      >
        STOP ALARM
      </button>

      {bubble && (
        <RageBubble text={bubble.text} x={render.x} y={render.y} styleKind={bubble.styleKind} />
      )}

      {freeze && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/55 backdrop-blur-[2px]">
          <p className="ml max-w-sm px-6 text-center text-2xl font-bold text-white">{freeze}</p>
        </div>
      )}
    </>
  );
}
