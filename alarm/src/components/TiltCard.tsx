import { useRef, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  className?: string;
  intensity?: number;
}

export function TiltCard({ children, className = "", intensity = 10 }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={ref}
      className={className}
      onPointerMove={(e) => {
        const el = ref.current;
        if (!el || e.pointerType === "touch") return;
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        el.style.transform = `rotateY(${px * intensity}deg) rotateX(${-py * intensity}deg)`;
      }}
      onPointerLeave={() => {
        const el = ref.current;
        if (el) el.style.transform = "rotateY(0deg) rotateX(0deg)";
      }}
    >
      {children}
    </div>
  );
}
