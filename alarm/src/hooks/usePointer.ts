import { useEffect, useRef } from "react";

export interface PointerState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  active: boolean;
}

export function usePointer() {
  const ref = useRef<PointerState>({
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    active: false,
  });

  useEffect(() => {
    let lastX = 0;
    let lastY = 0;
    let lastT = performance.now();

    const update = (x: number, y: number, active: boolean) => {
      const t = performance.now();
      const dt = Math.max(8, t - lastT);
      ref.current.vx = (x - lastX) / dt;
      ref.current.vy = (y - lastY) / dt;
      ref.current.x = x;
      ref.current.y = y;
      ref.current.active = active;
      lastX = x;
      lastY = y;
      lastT = t;
    };

    const onMove = (e: PointerEvent) => update(e.clientX, e.clientY, true);
    const onLeave = () => {
      ref.current.active = false;
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onMove, { passive: true });
    window.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onMove);
      window.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return ref;
}
