import { useEffect, useRef, type RefObject } from "react";
import type { AlarmStatus } from "../game/types";
import type { PointerState } from "../hooks/usePointer";

interface Props {
  status: AlarmStatus;
  pointer: RefObject<PointerState>;
  beat: number;
}

export function Background({ status, pointer, beat }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dots = useRef(
    Array.from({ length: 56 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: 0.5 + Math.random() * 1.7,
      s: 0.06 + Math.random() * 0.22,
      tick: Math.random() * Math.PI * 2,
    })),
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const draw = () => {
      const w = (canvas.width = window.innerWidth);
      const h = (canvas.height = window.innerHeight);
      ctx.clearRect(0, 0, w, h);

      const intense = status === "RINGING" || status === "CHALLENGE";
      const calmWin = status === "DEFEATED";
      const beatAge = Math.max(0, 1 - (performance.now() - beat) / 280);
      const pulse = intense ? 0.1 + beatAge * 0.28 : calmWin ? 0.05 : 0.04;

      const gx = pointer.current.x || w * 0.5;
      const gy = pointer.current.y || h * 0.4;

      const base = ctx.createLinearGradient(0, 0, w, h);
      if (calmWin) {
        base.addColorStop(0, "#06140f");
        base.addColorStop(1, "#07060c");
      } else if (intense) {
        base.addColorStop(0, "#14060b");
        base.addColorStop(1, "#1a0810");
      } else {
        base.addColorStop(0, "#07060c");
        base.addColorStop(1, "#0c0812");
      }
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, w, h);

      const glow = ctx.createRadialGradient(gx, gy, 18, gx, gy, intense ? 460 : 300);
      glow.addColorStop(0, `rgba(${intense ? "255,40,70" : "255,59,107"},${pulse})`);
      glow.addColorStop(1, "rgba(7,6,12,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = intense ? "rgba(255,80,110,0.1)" : "rgba(255,255,255,0.035)";
      ctx.lineWidth = 1;
      const step = 56;
      const drift = reduced ? 0 : (performance.now() / 80) % step;
      for (let x = -step + (gx % step); x < w + step; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + drift * 0.18, h);
        ctx.stroke();
      }
      for (let y = -step + drift; y < h + step; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      ctx.strokeStyle = intense ? "rgba(255,209,102,0.12)" : "rgba(255,255,255,0.05)";
      for (let i = 0; i < 3; i++) {
        const cx = w * (0.18 + i * 0.32);
        const cy = h * 0.22;
        ctx.beginPath();
        ctx.arc(cx, cy, 22 + i * 8, -Math.PI / 2, Math.PI * (0.4 + (performance.now() / 4000) % 1));
        ctx.stroke();
      }

      for (const d of dots.current) {
        if (!reduced) d.y -= d.s * 0.00045;
        if (d.y < 0) d.y = 1;
        const follow = intense ? 0.045 : 0.022;
        const px = d.x * w + (gx - w / 2) * follow;
        const py = d.y * h;
        ctx.beginPath();
        ctx.fillStyle = intense
          ? `rgba(255,180,80,${0.35 + beatAge * 0.4})`
          : "rgba(255,255,255,0.22)";
        ctx.arc(px, py, d.r + beatAge * 1.4, 0, Math.PI * 2);
        ctx.fill();
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [status, pointer, beat]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-0"
      aria-hidden
    />
  );
}
