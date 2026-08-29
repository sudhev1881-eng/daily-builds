import { useCallback, useEffect, useRef } from "react";
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
  const animRef = useRef<number>(0);
  const smoothPos = useRef({ x: personX, y: personY });
  const targetPos = useRef({ x: personX, y: personY });
  const pulsePhase = useRef(0);
  const layoutRef = useRef({ scale: 1, offsetX: 0, offsetY: 0, w: 0, h: 0 });

  // Fixed coordinate transform: room meters → canvas pixels (no pan, no follow)
  const computeLayout = useCallback(
    (canvasW: number, canvasH: number) => {
      const availW = canvasW - PADDING * 2;
      const availH = canvasH - PADDING * 2;
      const scaleX = availW / room.width;
      const scaleY = availH / room.height;
      const scale = Math.min(scaleX, scaleY);
      const roomPxW = room.width * scale;
      const roomPxH = room.height * scale;
      const offsetX = (canvasW - roomPxW) / 2;
      const offsetY = (canvasH - roomPxH) / 2;
      return { scale, offsetX, offsetY, roomPxW, roomPxH };
    },
    [room.width, room.height]
  );

  const worldToScreen = useCallback(
    (wx: number, wy: number) => {
      const { scale, offsetX, offsetY } = layoutRef.current;
      return {
        x: offsetX + wx * scale,
        y: offsetY + (room.height - wy) * scale,
      };
    },
    [room.height]
  );

  // Update target with deadband — only move when change is meaningful
  useEffect(() => {
    if (!personVisible) return;
    const dx = personX - targetPos.current.x;
    const dy = personY - targetPos.current.y;
    if (Math.hypot(dx, dy) >= POSITION_DEADBAND || personMoving) {
      targetPos.current = { x: personX, y: personY };
    }
  }, [personX, personY, personVisible, personMoving]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const w = rect.width;
    const h = rect.height;
    const layout = computeLayout(w, h);
    layoutRef.current = { ...layout, w, h };

    const { scale, offsetX, offsetY, roomPxW, roomPxH } = layout;

    // Background
    ctx.fillStyle = "#060a12";
    ctx.fillRect(0, 0, w, h);

    // Grid (1m intervals)
    ctx.strokeStyle = "rgba(56,189,248,0.06)";
    ctx.lineWidth = 0.5;
    for (let gx = 0; gx <= room.width; gx += GRID_SIZE) {
      const sx = offsetX + gx * scale;
      ctx.beginPath();
      ctx.moveTo(sx, offsetY);
      ctx.lineTo(sx, offsetY + roomPxH);
      ctx.stroke();
    }
    for (let gy = 0; gy <= room.height; gy += GRID_SIZE) {
      const sy = offsetY + (room.height - gy) * scale;
      ctx.beginPath();
      ctx.moveTo(offsetX, sy);
      ctx.lineTo(offsetX + roomPxW, sy);
      ctx.stroke();
    }

    // Room floor
    ctx.fillStyle = "rgba(15,23,42,0.5)";
    ctx.fillRect(offsetX, offsetY, roomPxW, roomPxH);

    // Heatmap (only meaningful movement data passed in)
    const cellSize = scale * 0.5;
    for (const cell of heatmap) {
      if (cell.intensity < 0.05) continue;
      const pos = worldToScreen(cell.x, cell.y);
      const alpha = Math.min(cell.intensity * 0.5, 0.6);
      const gradient = ctx.createRadialGradient(
        pos.x, pos.y, 0, pos.x, pos.y, cellSize
      );
      gradient.addColorStop(0, `rgba(56,189,248,${alpha})`);
      gradient.addColorStop(1, "rgba(56,189,248,0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(pos.x - cellSize, pos.y - cellSize, cellSize * 2, cellSize * 2);
    }

    // Walls
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
      const dx = cx === offsetX ? 1 : -1;
      const dy = cy === offsetY ? 1 : -1;
      ctx.beginPath();
      ctx.moveTo(cx, cy + dy * cornerLen);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx + dx * cornerLen, cy);
      ctx.stroke();
    }

    // Movement trails
    const now = Date.now();
    const recentTrails = trails.filter((t) => now - t.timestamp < 8000);
    if (recentTrails.length > 1) {
      ctx.beginPath();
      ctx.strokeStyle = "rgba(56,189,248,0.25)";
      ctx.lineWidth = 1.5;
      for (let i = 0; i < recentTrails.length; i++) {
        const pos = worldToScreen(recentTrails[i].x, recentTrails[i].y);
        if (i === 0) ctx.moveTo(pos.x, pos.y);
        else ctx.lineTo(pos.x, pos.y);
      }
      ctx.stroke();
    }
    for (const trail of recentTrails) {
      const age = (now - trail.timestamp) / 8000;
      if (age > 1) continue;
      const pos = worldToScreen(trail.x, trail.y);
      const alpha = (1 - age) * trail.intensity * 0.7;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 3 * (1 - age * 0.5), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(56,189,248,${alpha})`;
      ctx.fill();
    }

    // Sensors
    pulsePhase.current += 0.03;
    const drawSensor = (
      sx: number, sy: number, label: string, color: string, icon: string
    ) => {
      const pos = worldToScreen(sx, sy);

      if (movementDetected) {
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

    drawSensor(room.router.x, room.router.y, "ROUTER", "#0ea5e9", "📡");
    drawSensor(room.receiver.x, room.receiver.y, "RECEIVER", "#8b5cf6", "📶");

    // Fan indicator (environmental)
    const fanPos = worldToScreen(room.width * 0.75, room.height * 0.3);
    ctx.fillStyle = "rgba(251,191,36,0.15)";
    ctx.font = "9px JetBrains Mono";
    ctx.textAlign = "center";
    ctx.fillText("FAN", fanPos.x, fanPos.y - 8);

    // Person marker — smooth interpolation toward target
    if (personVisible) {
      smoothPos.current.x +=
        (targetPos.current.x - smoothPos.current.x) * LERP_FACTOR;
      smoothPos.current.y +=
        (targetPos.current.y - smoothPos.current.y) * LERP_FACTOR;

      const pos = worldToScreen(smoothPos.current.x, smoothPos.current.y);

      if (personMoving) {
        const glow = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, 20);
        glow.addColorStop(0, "rgba(52,211,153,0.25)");
        glow.addColorStop(1, "rgba(52,211,153,0)");
        ctx.fillStyle = glow;
        ctx.fillRect(pos.x - 25, pos.y - 25, 50, 50);
      }

      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 8, 0, Math.PI * 2);
      ctx.fillStyle = personMoving ? "#34d399" : "#6ee7b7";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.4)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      if (direction !== null && personMoving) {
        const arrowLen = 18;
        const ax = pos.x + Math.cos(direction) * arrowLen;
        const ay = pos.y - Math.sin(direction) * arrowLen;
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

    // Origin marker
    const origin = worldToScreen(0, 0);
    ctx.fillStyle = "rgba(100,116,139,0.5)";
    ctx.font = "8px JetBrains Mono";
    ctx.textAlign = "left";
    ctx.fillText("(0,0)", origin.x + 4, origin.y - 4);

    // Dimension labels
    ctx.fillStyle = "#475569";
    ctx.font = "10px JetBrains Mono";
    ctx.textAlign = "center";
    ctx.fillText(`${room.width}m`, offsetX + roomPxW / 2, offsetY - 10);
    ctx.save();
    ctx.translate(offsetX - 15, offsetY + roomPxH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(`${room.height}m`, 0, 0);
    ctx.restore();

    animRef.current = requestAnimationFrame(draw);
  }, [
    room, personVisible, personMoving, direction, trails, heatmap,
    movementDetected, computeLayout, worldToScreen,
  ]);

  useEffect(() => {
    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [draw]);

  return (
    <div
      ref={containerRef}
      className="glass-panel relative h-full w-full overflow-hidden"
    >
      <div className="absolute top-3 left-3 z-10">
        <span className="font-mono text-[10px] tracking-wider text-slate-500 uppercase">
          Room Map — Fixed View
        </span>
      </div>
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  );
}
