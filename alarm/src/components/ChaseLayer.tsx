import { useEffect, useRef, useState, type RefObject } from "react";
import { CHASE_BAIT, FAKE_BAIT, pick } from "../data/ragebait";
import type { AlarmGame } from "../game/useAlarmGame";
import { FAKE_AFTER_MS, type FakeKind } from "../game/types";
import type { PointerState } from "../hooks/usePointer";

interface Props {
  game: AlarmGame;
  pointer: RefObject<PointerState>;
}

const BTN_W = 168;
const BTN_H = 56;

interface FakeBtn {
  id: number;
  kind: FakeKind;
  x: number;
  y: number;
}

export function ChaseLayer({ game, pointer }: Props) {
  const pos = useRef({ x: window.innerWidth / 2 - BTN_W / 2, y: window.innerHeight * 0.62 });
  const vel = useRef({ x: 0, y: 0 });
  const [render, setRender] = useState({ ...pos.current });
  const [bubble, setBubble] = useState<{ text: string; life: number } | null>(null);

  useEffect(() => {
    if (!bubble) return;
    const wait = Math.max(0, bubble.life - performance.now());
    const id = window.setTimeout(() => setBubble(null), wait);
    return () => window.clearTimeout(id);
  }, [bubble]);
  const [fakes, setFakes] = useState<FakeBtn[]>([]);
  const [freeze, setFreeze] = useState<string | null>(null);
  const hesitated = useRef(false);
  const hesitating = useRef(false);
  const lastEscape = useRef(0);
  const started = useRef(performance.now());
  const fakeStage = useRef(0);
  const noteEscape = useRef(game.noteEscape);
  const panicRef = useRef(game.panic);
  noteEscape.current = game.noteEscape;
  panicRef.current = game.panic;

  useEffect(() => {
    started.current = performance.now();
    pos.current = {
      x: window.innerWidth / 2 - BTN_W / 2,
      y: window.innerHeight * 0.58,
    };
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
      const danger = panic ? 150 : 108;

      if (p.active && dist < danger && !hesitating.current) {
        if (!hesitated.current && dist < danger * 0.7) {
          hesitated.current = true;
          hesitating.current = true;
          setBubble({ text: pick(CHASE_BAIT), life: performance.now() + 900 });
          window.setTimeout(() => {
            hesitating.current = false;
            const ang = Math.atan2(dy || 1, dx || 1);
            vel.current.x += Math.cos(ang) * (panic ? 28 : 18);
            vel.current.y += Math.sin(ang) * (panic ? 28 : 18);
            noteEscape.current();
            lastEscape.current = performance.now();
          }, panic ? 160 : 380);
        } else if (!hesitating.current) {
          const fromLeft = p.x < cx;
          const fromTop = p.y < cy;
          let ox = fromLeft ? 1 : -1;
          let oy = fromTop ? 1 : -1;
          if (Math.abs(dx) > Math.abs(dy)) oy *= 0.45;
          else ox *= 0.45;
          const force = (danger - dist) / danger;
          vel.current.x += ox * force * (panic ? 4.2 : 2.4);
          vel.current.y += oy * force * (panic ? 4.2 : 2.4);
          if (dist < 46 && performance.now() - lastEscape.current > 420) {
            noteEscape.current();
            lastEscape.current = performance.now();
            setBubble({ text: pick(CHASE_BAIT), life: performance.now() + 700 });
          }
        }
      }

      if (!hesitating.current) {
        pos.current.x += vel.current.x;
        pos.current.y += vel.current.y;
      }
      vel.current.x *= 0.86;
      vel.current.y *= 0.86;

      if (pos.current.x < pad) {
        pos.current.x = pad;
        vel.current.x = Math.abs(vel.current.x) + 4;
      }
      if (pos.current.y < pad + 48) {
        pos.current.y = pad + 48;
        vel.current.y = Math.abs(vel.current.y) + 4;
      }
      if (pos.current.x > maxX) {
        pos.current.x = maxX;
        vel.current.x = -Math.abs(vel.current.x) - 4;
      }
      if (pos.current.y > maxY) {
        pos.current.y = maxY;
        vel.current.y = -Math.abs(vel.current.y) - 4;
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
            y: window.innerHeight - 120,
          },
        ]);
      }
      if (game.panic && fakeStage.current < 4 && Math.random() < 0.35) {
        setFakes((prev) => [
          ...prev.slice(-3),
          {
            id: Date.now(),
            kind: "stop",
            x: 20 + Math.random() * (window.innerWidth - BTN_W - 40),
            y: 80 + Math.random() * (window.innerHeight - 160),
          },
        ]);
      }
    }, 900);
    return () => window.clearInterval(id);
  }, [game.panic]);

  const clickFake = (btn: FakeBtn) => {
    game.noteFake();
    setFreeze(
      btn.kind === "stop"
        ? pick(FAKE_BAIT)
        : btn.kind === "really"
          ? "ഇത്ര പെട്ടെന്ന് വിശ്വസിച്ചോ? 😭"
          : "ഇത് ആണ് ശരിയെന്ന് തോന്നിയോ? 🥲",
    );
    window.setTimeout(() => {
      setFreeze(null);
      if (btn.kind === "stop") {
        setFakes([{ id: Date.now(), kind: "really", x: btn.x, y: Math.max(80, btn.y - 80) }]);
      } else if (btn.kind === "really") {
        setFakes([
          {
            id: Date.now(),
            kind: "actually",
            x: window.innerWidth / 2 - BTN_W / 2,
            y: window.innerHeight * 0.35,
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
        <div className="pointer-events-none fixed top-16 left-1/2 z-20 -translate-x-1/2 rounded-full bg-red-600 px-4 py-1 text-xs font-black tracking-[0.25em] text-white">
          PANIC MODE
        </div>
      )}

      {fakes.map((f) => (
        <button
          key={f.id}
          type="button"
          className="interactive-btn fixed z-25 rounded-2xl bg-rose-500 px-5 py-3 text-sm font-black text-white shadow-lg"
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
        onPointerDown={(e) => {
          e.stopPropagation();
          game.caughtStop();
        }}
      >
        STOP ALARM
      </button>

      {bubble && (
        <div
          className="ml pointer-events-none fixed z-30 max-w-[220px] rounded-2xl bg-white px-3 py-2 text-sm text-zinc-900 shadow-xl"
          style={{ left: render.x + 20, top: render.y - 56 }}
        >
          {bubble.text}
        </div>
      )}

      {freeze && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50">
          <p className="ml max-w-sm px-6 text-center text-2xl font-bold text-white">{freeze}</p>
        </div>
      )}
    </>
  );
}
