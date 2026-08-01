"use client";

import { useEffect, useRef, useState } from "react";

interface AnimatedNumberProps {
  value: number;
  format: (value: number) => string;
  className?: string;
  durationMs?: number;
}

export function AnimatedNumber({
  value,
  format,
  className,
  durationMs = 650,
}: AnimatedNumberProps) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const from = fromRef.current;
    const start = performance.now();

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = from + (value - from) * eased;
      setDisplay(next);
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = value;
      }
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [value, durationMs]);

  return (
    <span className={className} aria-label={format(value)}>
      {format(display)}
    </span>
  );
}
