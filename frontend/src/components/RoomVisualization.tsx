import { useEffect, useRef, type MouseEvent } from "react";
import type {
  HeatmapCell,
  RoomConfig,
  TrackedPerson,
  TrailPoint,
} from "../types/sensor";
import { personColor, personLabel } from "../types/sensor";

interface RoomVisualizationProps {
  room: RoomConfig;
  people: TrackedPerson[];
  trails: TrailPoint[];
  heatmap: HeatmapCell[];
  movementDetected: boolean;
  accuracyRadius: number;
  clickToWalk: boolean;
  onRoomClick?: (x: number, y: number) => void;
}

const PADDING = 48;
const GRID_SIZE = 1.0;
const LERP_FACTOR = 0.12;
const MIN_CANVAS_SIZE = 10;

interface Layout {
  scale: number;
  offsetX: number;
  offsetY: number;
  roomPxW: number;
  roomPxH: number;
}

export function RoomVisualization({
  room,
  people,
  trails,
  heatmap,
  movementDetected,
  accuracyRadius,
  clickToWalk,
  onRoomClick,
}: RoomVisualizationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const roomRef = useRef(room);
  const propsRef = useRef({ people, trails, heatmap, movementDetected, accuracyRadius });
  const layoutRef = useRef<Layout | null>(null);
  const smoothRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pulsePhase = useRef(0);
  const animRef = useRef(0);
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 });

  roomRef.current = room;
  propsRef.current = { people, trails, heatmap, movementDetected, accuracyRadius };

  function computeLayout(w: number, h: number, r: RoomConfig): Layout {
    const availW = w - PADDING * 2;
    const availH = h - PADDING * 2;
    const scale = Math.min(availW / r.width, availH / r.height);
    const roomPxW = r.width * scale;
    const roomPxH = r.height * scale;
    return {
      scale,
      offsetX: (w - roomPxW) / 2,
      offsetY: (h - roomPxH) / 2,
      roomPxW,
      roomPxH,
    };
  }

  function worldToScreen(wx: number, wy: number, layout: Layout, roomHeight: number) {
    return {
      x: layout.offsetX + wx * layout.scale,
      y: layout.offsetY + (roomHeight - wy) * layout.scale,
    };
  }

  function syncLayout(forceLayout = false): boolean {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return false;

    const w = Math.round(container.clientWidth);
    const h = Math.round(container.clientHeight);
    if (w < MIN_CANVAS_SIZE || h < MIN_CANVAS_SIZE) return false;

    const dpr = window.devicePixelRatio || 1;
    const sizeChanged =
      sizeRef.current.w !== w ||
      sizeRef.current.h !== h ||
      sizeRef.current.dpr !== dpr;

    if (sizeChanged) {
      sizeRef.current = { w, h, dpr };
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      layoutRef.current = computeLayout(w, h, roomRef.current);
    } else if (forceLayout) {
      layoutRef.current = computeLayout(w, h, roomRef.current);
    }

    return layoutRef.current !== null;
  }

  function draw() {
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
    const { scale, offsetX, offsetY, roomPxW, roomPxH } = layout;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#060a12";
    ctx.fillRect(0, 0, w, h);

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

    ctx.fillStyle = "rgba(15,23,42,0.5)";
    ctx.fillRect(offsetX, offsetY, roomPxW, roomPxH);

    // Heatmap
    const cellSize = scale * 0.5;
    for (const cell of p.heatmap) {
      if (cell.intensity < 0.05) continue;
      const pos = worldToScreen(cell.x, cell.y, layout, r.height);
      const alpha = Math.min(cell.intensity * 0.5, 0.6);
      const gradient = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, cellSize);
      gradient.addColorStop(0, `rgba(56,189,248,${alpha})`);
      gradient.addColorStop(1, "rgba(56,189,248,0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(pos.x - cellSize, pos.y - cellSize, cellSize * 2, cellSize * 2);
    }

    // Walls
    ctx.strokeStyle = "rgba(56,189,248,0.4)";
    ctx.lineWidth = 2;
    ctx.strokeRect(offsetX, offsetY, roomPxW, roomPxH);

    // Trails — one polyline per person, in that person's color
    const now = Date.now();
    const byPerson = new Map<number, TrailPoint[]>();
    for (const t of p.trails) {
      if (now - t.timestamp >= 8000) continue;
      const list = byPerson.get(t.personId) ?? [];
      list.push(t);
      byPerson.set(t.personId, list);
    }
    for (const [pid, points] of byPerson) {
      if (points.length < 2) continue;
      const color = personColor(pid, points[0].isUser);
      ctx.beginPath();
      ctx.strokeStyle = `rgba(${color.glow},0.25)`;
      ctx.lineWidth = 1.5;
      for (let i = 0; i < points.length; i++) {
        const pos = worldToScreen(points[i].x, points[i].y, layout, r.height);
        if (i === 0) ctx.moveTo(pos.x, pos.y);
        else ctx.lineTo(pos.x, pos.y);
      }
      ctx.stroke();
    }

    // Sensors
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
      ctx.fillText(label, pos.x, pos.y - 14);
    };

    drawSensor(r.router.x, r.router.y, "ROUTER", "#0ea5e9", "📡");
    drawSensor(r.receiver.x, r.receiver.y, "RECEIVER", "#8b5cf6", "📶");

    // People — snap on appear, smooth only while moving
    const activeIds = new Set<number>();
    for (const person of p.people) {
      activeIds.add(person.id);
      const color = personColor(person.id, person.is_user);

      let smooth = smoothRef.current.get(person.id);
      if (!smooth) {
        smooth = { x: person.x, y: person.y };
        smoothRef.current.set(person.id, smooth);
      } else if (person.moving) {
        smooth.x += (person.x - smooth.x) * LERP_FACTOR;
        smooth.y += (person.y - smooth.y) * LERP_FACTOR;
      } else {
        smooth.x = person.x;
        smooth.y = person.y;
      }

      const pos = worldToScreen(smooth.x, smooth.y, layout, r.height);

      if (person.moving) {
        const glow = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, 20);
        glow.addColorStop(0, `rgba(${color.glow},0.25)`);
        glow.addColorStop(1, `rgba(${color.glow},0)`);
        ctx.fillStyle = glow;
        ctx.fillRect(pos.x - 25, pos.y - 25, 50, 50);
      }

      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 8, 0, Math.PI * 2);
      ctx.fillStyle = person.moving ? color.main : color.still;
      ctx.fill();

      // Accuracy uncertainty circle
      const radiusPx = p.accuracyRadius * layout.scale;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, radiusPx, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${color.glow},0.25)`;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = "rgba(255,255,255,0.4)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Person label (YOU / P1 / P2 ...)
      ctx.fillStyle = person.is_user ? "#f9a8d4" : "#cbd5e1";
      ctx.font = person.is_user ? "bold 9px JetBrains Mono" : "9px JetBrains Mono";
      ctx.textAlign = "center";
      ctx.fillText(personLabel(person), pos.x, pos.y - 14);

      if (person.direction !== null && person.moving) {
        const ax = pos.x + Math.cos(person.direction) * 18;
        const ay = pos.y - Math.sin(person.direction) * 18;
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
        ctx.lineTo(ax, ay);
        ctx.strokeStyle = `rgba(${color.glow},0.7)`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    // Drop smoothing state for people no longer tracked
    for (const id of smoothRef.current.keys()) {
      if (!activeIds.has(id)) smoothRef.current.delete(id);
    }

    // Labels
    ctx.fillStyle = "#475569";
    ctx.font = "10px JetBrains Mono";
    ctx.textAlign = "center";
    ctx.fillText(`${r.width}m`, offsetX + roomPxW / 2, offsetY - 8);

    animRef.current = requestAnimationFrame(draw);
  }

  useEffect(() => {
    syncLayout(true);
    animRef.current = requestAnimationFrame(draw);

    const container = containerRef.current;
    if (!container) return () => cancelAnimationFrame(animRef.current);

    const observer = new ResizeObserver(() => {
      syncLayout(true);
    });
    observer.observe(container);

    return () => {
      cancelAnimationFrame(animRef.current);
      observer.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    syncLayout(true);
  }, [room.width, room.height, room.router.x, room.router.y, room.receiver.x, room.receiver.y]);

  function handleCanvasClick(e: MouseEvent<HTMLCanvasElement>) {
    if (!clickToWalk || !onRoomClick) return;
    const canvas = canvasRef.current;
    const layout = layoutRef.current;
    if (!canvas || !layout) return;

    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const r = roomRef.current;

    const wx = (px - layout.offsetX) / layout.scale;
    const wy = r.height - (py - layout.offsetY) / layout.scale;
    if (wx < 0 || wy < 0 || wx > r.width || wy > r.height) return;
    onRoomClick(wx, wy);
  }

  return (
    <div
      ref={containerRef}
      className="glass-panel absolute inset-0 overflow-hidden"
    >
      <div className="pointer-events-none absolute top-3 left-3 z-10">
        <span className="font-mono text-[10px] tracking-wider text-slate-500 uppercase">
          Room Map
        </span>
        {clickToWalk && (
          <span className="ml-2 font-mono text-[10px] text-pink-400/80">
            click anywhere to walk there
          </span>
        )}
      </div>
      <canvas
        ref={canvasRef}
        className="block h-full w-full"
        style={{ touchAction: "none", cursor: clickToWalk ? "crosshair" : "default" }}
        onClick={handleCanvasClick}
      />
    </div>
  );
}
