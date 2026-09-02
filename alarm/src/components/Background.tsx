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
    Array.from({ length: 48 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: 0.6 + Math.random() * 1.8,
      s: 0.08 + Math.random() * 0.2,
    })),
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;

    const draw = () => {
      const w = (canvas.width = window.innerWidth);
      const h = (canvas.height = window.innerHeight);
      ctx.clearRect(0, 0, w, h);

      const intense = status === "RINGING" || status === "CHALLENGE";
      const beatAge = Math.max(0, 1 - (performance.now() - beat) / 280);
      const pulse = intense ? 0.08 + beatAge * 0.22 : 0.04;

      const gx = pointer.current.x || w * 0.5;
      const gy = pointer.current.y || h * 0.4;
      const glow = ctx.createRadialGradient(gx, gy, 20, gx, gy, intense ? 420 : 280);
      glow.addColorStop(0, `rgba(255,59,107,${pulse})`);
      glow.addColorStop(1, "rgba(7,6,12,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = intense ? "rgba(255,80,110,0.08)" : "rgba(255,255,255,0.035)";
      ctx.lineWidth = 1;
      const step = 56;
      const drift = (performance.now() / 80) % step;
      for (let x = -step + (gx % step); x < w + step; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + drift * 0.15, h);
        ctx.stroke();
      }
      for (let y = -step + drift; y < h + step; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      for (const d of dots.current) {
        d.y -= d.s * 0.0004;
        if (d.y < 0) d.y = 1;
        const px = d.x * w + (gx - w / 2) * 0.02;
        const py = d.y * h;
        ctx.beginPath();
        ctx.fillStyle = intense ? "rgba(255,180,80,0.45)" : "rgba(255,255,255,0.22)";
        ctx.arc(px, py, d.r + beatAge, 0, Math.PI * 2);
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
