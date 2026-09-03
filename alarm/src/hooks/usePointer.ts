import { useEffect, useRef } from "react";

export interface PointerState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  active: boolean;
  coarse: boolean;
}

export function usePointer() {
  const ref = useRef<PointerState>({
    x: typeof window === "undefined" ? 0 : window.innerWidth / 2,
    y: typeof window === "undefined" ? 0 : window.innerHeight / 3,
    vx: 0,
    vy: 0,
    active: false,
    coarse: false,
  });

  useEffect(() => {
    let lastX = ref.current.x;
    let lastY = ref.current.y;
    let lastT = performance.now();
    const root = document.documentElement;

    const update = (x: number, y: number, active: boolean, coarse: boolean) => {
      const t = performance.now();
      const dt = Math.max(8, t - lastT);
      ref.current.vx = (x - lastX) / dt;
      ref.current.vy = (y - lastY) / dt;
      ref.current.x = x;
      ref.current.y = y;
      ref.current.active = active;
      ref.current.coarse = coarse;
      lastX = x;
      lastY = y;
      lastT = t;
      root.style.setProperty("--mx", `${x}px`);
      root.style.setProperty("--my", `${y}px`);
    };

    const onMove = (e: PointerEvent) => {
      update(e.clientX, e.clientY, true, e.pointerType === "touch");
    };
    const onLeave = () => {
      ref.current.active = false;
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onMove, { passive: true });
    window.addEventListener("pointerup", onLeave);
    window.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onMove);
      window.removeEventListener("pointerup", onLeave);
      window.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return ref;
}
