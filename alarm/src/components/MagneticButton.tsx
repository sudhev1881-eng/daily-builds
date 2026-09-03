import { useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  pull?: number;
}

export function MagneticButton({
  children,
  className = "",
  pull = 0.22,
  onPointerMove,
  onPointerLeave,
  ...rest
}: Props) {
  const ref = useRef<HTMLButtonElement>(null);
  const [off, setOff] = useState({ x: 0, y: 0 });

  return (
    <button
      {...rest}
      ref={ref}
      className={`magnetic-btn ${className}`}
      style={{ transform: `translate(${off.x}px, ${off.y}px)` }}
      onPointerMove={(e) => {
        onPointerMove?.(e);
        const el = ref.current;
        if (!el || e.pointerType === "touch") return;
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        setOff({ x: dx * pull, y: dy * pull });
      }}
      onPointerLeave={(e) => {
        onPointerLeave?.(e);
        setOff({ x: 0, y: 0 });
      }}
    >
      {children}
    </button>
  );
}
