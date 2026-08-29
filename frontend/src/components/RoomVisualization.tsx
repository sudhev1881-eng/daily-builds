import { useEffect, useRef } from "react";
import type { HeatmapCell, RoomConfig, TrailPoint } from "../types/sensor";

interface RoomVisualizationProps {
  room: RoomConfig;
  personX: number;
  personY: number;
  personVisible: boolean;
  personMoving: boolean;
  direction: number | null;
  trails: TrailPoint[];
  heatmap: HeatmapCell[];
  movementDetected: boolean;
}

const PADDING = 60;
const GRID_SIZE = 1.0;
const POSITION_DEADBAND = 0.15;
const LERP_FACTOR = 0.12;

interface Layout {
  scale: number;
  offsetX: number;
  offsetY: number;
  roomPxW: number;
  roomPxH: number;
  canvasW: number;
  canvasH: number;
}

export function RoomVisualization({
  room,
  personX,
  personY,
  personVisible,
  personMoving,
  direction,
  trails,
  heatmap,
  movementDetected,
}: RoomVisualizationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Stable refs — animation loop reads these without restarting on every prop change
  const roomRef = useRef(room);
  const propsRef = useRef({
    personX,
    personY,
    personVisible,
    personMoving,
    direction,
    trails,
    heatmap,
    movementDetected,
  });
  const layoutRef = useRef<Layout | null>(null);
  const smoothPos = useRef({ x: personX, y: personY });
  const targetPos = useRef({ x: personX, y: personY });
  const pulsePhase = useRef(0);
  const animRef = useRef(0);
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 });

  roomRef.current = room;
  propsRef.current = {
    personX,
    personY,
    personVisible,
    personMoving,
    direction,
    trails,
    heatmap,
    movementDetected,
  };

  // Update person target with deadband
  if (personVisible) {
    const dx = personX - targetPos.current.x;
    const dy = personY - targetPos.current.y;
    if (Math.hypot(dx, dy) >= POSITION_DEADBAND || personMoving) {
      targetPos.current = { x: personX, y: personY };
    }
  }

  function computeLayout(canvasW: number, canvasH: number, r: RoomConfig): Layout {
    const availW = canvasW - PADDING * 2;
    const availH = canvasH - PADDING * 2;
    const scaleX = availW / r.width;
    const scaleY = availH / r.height;
    const scale = Math.min(scaleX, scaleY);
    const roomPxW = r.width * scale;
    const roomPxH = r.height * scale;
    const offsetX = (canvasW - roomPxW) / 2;
    const offsetY = (canvasH - roomPxH) / 2;
    return { scale, offsetX, offsetY, roomPxW, roomPxH, canvasW, canvasH };
  }

  function worldToScreen(wx: number, wy: number, layout: Layout, roomHeight: number) {
    return {
      x: layout.offsetX + wx * layout.scale,
      y: layout.offsetY + (roomHeight - wy) * layout.scale,
    };
  }

  function resizeCanvas() {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const w = Math.floor(rect.width);
    const h = Math.floor(rect.height);
    if (w <= 0 || h <= 0) return;

    const dpr = window.devicePixelRatio || 1;

    // Only touch canvas dimensions when size actually changed
    if (sizeRef.current.w !== w || sizeRef.current.h !== h || sizeRef.current.dpr !== dpr) {
      sizeRef.current = { w, h, dpr };
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      layoutRef.current = computeLayout(w, h, roomRef.current);
    }
  }

  function draw() {
    resizeCanvas();

    const canvas = canvasRef.current;
    const layout = layoutRef.current;
    if (!canvas || !layout) {
      animRef.current = requestAnimationFrame(draw);
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      animRef.current = requestAnimationFrame(draw);
      return;
    }

    const { w, h, dpr } = sizeRef.current;
    const r = roomRef.current;
    const p = propsRef.current;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const { scale, offsetX, offsetY, roomPxW, roomPxH } = layout;

    // --- Static room layer (never moves once layout is set) ---
    ctx.fillStyle = "#060a12";
    ctx.fillRect(0, 0, w, h);

    // Fixed screen-space anchor dots to verify room is not drifting
    ctx.fillStyle = "rgba(56,189,248,0.15)";
    for (const [ax, ay] of [
      [8, 8],
      [w - 8, 8],
      [8, h - 8],
      [w - 8, h - 8],
    ]) {
      ctx.beginPath();
      ctx.arc(ax, ay, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Grid
    ctx.strokeStyle = "rgba(56,189,248,0.06)";
    ctx.lineWidth = 0.5;
    for (let gx = 0; gx <= r.width; gx += GRID_SIZE) {
      const sx = offsetX + gx * scale;
      ctx.beginPath();
      ctx.moveTo(sx, offsetY);
      ctx.lineTo(sx, offsetY + roomPxH);
      ctx.stroke();
    }
    for (let gy = 0; gy <= r.height; gy += GRID_SIZE) {
      const sy = offsetY + (r.height - gy) * scale;
      ctx.beginPath();
      ctx.moveTo(offsetX, sy);
      ctx.lineTo(offsetX + roomPxW, sy);
      ctx.stroke();
    }

    // Room floor
    ctx.fillStyle = "rgba(15,23,42,0.5)";
    ctx.fillRect(offsetX, offsetY, roomPxW, roomPxH);

    // Heatmap
    const cellSize = scale * 0.5;
    for (const cell of p.heatmap) {
      if (cell.intensity < 0.05) continue;
      const pos = worldToScreen(cell.x, cell.y, layout, r.height);
      const alpha = Math.min(cell.intensity * 0.5, 0.6);
      const gradient = ctx.createRadialGradient(
        pos.x, pos.y, 0, pos.x, pos.y, cellSize
      );
      gradient.addColorStop(0, `rgba(56,189,248,${alpha})`);
      gradient.addColorStop(1, "rgba(56,189,248,0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(pos.x - cellSize, pos.y - cellSize, cellSize * 2, cellSize * 2);
    }

    // Walls — fixed rectangle, never follows person
    ctx.strokeStyle = "rgba(56,189,248,0.4)";
    ctx.lineWidth = 2;
    ctx.strokeRect(offsetX, offsetY, roomPxW, roomPxH);

    // Corner accents
    const cornerLen = 12;
    ctx.strokeStyle = "rgba(56,189,248,0.7)";
    ctx.lineWidth = 2;
    const corners: [number, number][] = [
      [offsetX, offsetY],
      [offsetX + roomPxW, offsetY],
      [offsetX, offsetY + roomPxH],
      [offsetX + roomPxW, offsetY + roomPxH],
    ];
    for (const [cx, cy] of corners) {
      const cdx = cx === offsetX ? 1 : -1;
      const cdy = cy === offsetY ? 1 : -1;
      ctx.beginPath();
      ctx.moveTo(cx, cy + cdy * cornerLen);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx + cdx * cornerLen, cy);
      ctx.stroke();
    }

    // Trails
    const now = Date.now();
    const recentTrails = p.trails.filter((t) => now - t.timestamp < 8000);
    if (recentTrails.length > 1) {
      ctx.beginPath();
      ctx.strokeStyle = "rgba(56,189,248,0.25)";
      ctx.lineWidth = 1.5;
      for (let i = 0; i < recentTrails.length; i++) {
        const pos = worldToScreen(recentTrails[i].x, recentTrails[i].y, layout, r.height);
        if (i === 0) ctx.moveTo(pos.x, pos.y);
        else ctx.lineTo(pos.x, pos.y);
      }
      ctx.stroke();
    }
    for (const trail of recentTrails) {
      const age = (now - trail.timestamp) / 8000;
      if (age > 1) continue;
      const pos = worldToScreen(trail.x, trail.y, layout, r.height);
      const alpha = (1 - age) * trail.intensity * 0.7;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 3 * (1 - age * 0.5), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(56,189,248,${alpha})`;
      ctx.fill();
    }

    // Sensors — fixed world positions
    pulsePhase.current += 0.03;
    const drawSensor = (sx: number, sy: number, label: string, color: string, icon: string) => {
      const pos = worldToScreen(sx, sy, layout, r.height);

      if (p.movementDetected) {
        const pulseR = 10 + Math.sin(pulsePhase.current) * 3;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, pulseR + 8, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(56,189,248,${0.12 + Math.sin(pulsePhase.current) * 0.06})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 10, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.3)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = "#e2e8f0";
      ctx.font = "10px JetBrains Mono";
      ctx.textAlign = "center";
      ctx.fillText(icon, pos.x, pos.y + 4);
      ctx.fillStyle = "#64748b";
      ctx.font = "9px JetBrains Mono";
      ctx.fillText(label, pos.x, pos.y - 16);
      ctx.fillText(`(${sx.toFixed(1)}, ${sy.toFixed(1)})`, pos.x, pos.y + 22);
    };

    drawSensor(r.router.x, r.router.y, "ROUTER", "#0ea5e9", "📡");
    drawSensor(r.receiver.x, r.receiver.y, "RECEIVER", "#8b5cf6", "📶");

    // Fan — fixed position
    const fanPos = worldToScreen(r.width * 0.75, r.height * 0.3, layout, r.height);
    ctx.fillStyle = "rgba(251,191,36,0.4)";
    ctx.font = "9px JetBrains Mono";
    ctx.textAlign = "center";
    ctx.fillText("FAN", fanPos.x, fanPos.y - 8);

    // Person marker — only this moves inside the fixed room
    if (p.personVisible) {
      smoothPos.current.x +=
        (targetPos.current.x - smoothPos.current.x) * LERP_FACTOR;
      smoothPos.current.y +=
        (targetPos.current.y - smoothPos.current.y) * LERP_FACTOR;

      const pos = worldToScreen(smoothPos.current.x, smoothPos.current.y, layout, r.height);

      if (p.personMoving) {
        const glow = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, 20);
        glow.addColorStop(0, "rgba(52,211,153,0.25)");
        glow.addColorStop(1, "rgba(52,211,153,0)");
        ctx.fillStyle = glow;
        ctx.fillRect(pos.x - 25, pos.y - 25, 50, 50);
      }

      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 8, 0, Math.PI * 2);
      ctx.fillStyle = p.personMoving ? "#34d399" : "#6ee7b7";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.4)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      if (p.direction !== null && p.personMoving) {
        const arrowLen = 18;
        const ax = pos.x + Math.cos(p.direction) * arrowLen;
        const ay = pos.y - Math.sin(p.direction) * arrowLen;
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
        ctx.lineTo(ax, ay);
        ctx.strokeStyle = "rgba(52,211,153,0.7)";
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      ctx.fillStyle = "#94a3b8";
      ctx.font = "9px JetBrains Mono";
      ctx.textAlign = "center";
      ctx.fillText("ESTIMATED", pos.x, pos.y - 18);
      ctx.fillStyle = "#64748b";
      ctx.font = "8px JetBrains Mono";
      ctx.fillText(
        `(${smoothPos.current.x.toFixed(1)}, ${smoothPos.current.y.toFixed(1)})m`,
        pos.x,
        pos.y + 24
      );
    }

    // Origin
    const origin = worldToScreen(0, 0, layout, r.height);
    ctx.fillStyle = "rgba(100,116,139,0.5)";
    ctx.font = "8px JetBrains Mono";
    ctx.textAlign = "left";
    ctx.fillText("(0,0)", origin.x + 4, origin.y - 4);

    // Dimension labels
    ctx.fillStyle = "#475569";
    ctx.font = "10px JetBrains Mono";
    ctx.textAlign = "center";
    ctx.fillText(`${r.width}m`, offsetX + roomPxW / 2, offsetY - 10);
    ctx.save();
    ctx.translate(offsetX - 15, offsetY + roomPxH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(`${r.height}m`, 0, 0);
    ctx.restore();

    animRef.current = requestAnimationFrame(draw);
  }

  // Single stable animation loop — never restarted by prop changes
  useEffect(() => {
    layoutRef.current = null;
    resizeCanvas();
    animRef.current = requestAnimationFrame(draw);

    const container = containerRef.current;
    if (!container) return () => cancelAnimationFrame(animRef.current);

    const observer = new ResizeObserver(() => {
      layoutRef.current = null; // recompute layout only on real resize
      resizeCanvas();
    });
    observer.observe(container);

    return () => {
      cancelAnimationFrame(animRef.current);
      observer.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recompute layout when room dimensions change (config panel)
  useEffect(() => {
    layoutRef.current = null;
    resizeCanvas();
  }, [room.width, room.height, room.router.x, room.router.y, room.receiver.x, room.receiver.y]);

  return (
    <div
      ref={containerRef}
      className="glass-panel relative h-full w-full overflow-hidden"
    >
      <div className="pointer-events-none absolute top-3 left-3 z-10">
        <span className="font-mono text-[10px] tracking-wider text-slate-500 uppercase">
          Room Map — Fixed View
        </span>
      </div>
      <canvas
        ref={canvasRef}
        className="block h-full w-full"
        style={{ touchAction: "none" }}
      />
    </div>
  );
}
