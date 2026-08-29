import { useCallback, useEffect, useRef, useState } from "react";
import type { HeatmapCell, RoomConfig, TrailPoint } from "../types/sensor";

interface RoomVisualizationProps {
  room: RoomConfig;
  personX: number;
  personY: number;
  personPresent: boolean;
  personMoving: boolean;
  direction: number | null;
  trails: TrailPoint[];
  heatmap: HeatmapCell[];
  movementDetected: boolean;
}

const PADDING = 60;
const GRID_SIZE = 0.5;

export function RoomVisualization({
  room,
  personX,
  personY,
  personPresent,
  personMoving,
  direction,
  trails,
  heatmap,
  movementDetected,
}: RoomVisualizationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const animRef = useRef<number>(0);
  const smoothPos = useRef({ x: personX, y: personY });
  const pulsePhase = useRef(0);

  const getScale = useCallback(
    (canvasW: number, canvasH: number) => {
      const availW = canvasW - PADDING * 2;
      const availH = canvasH - PADDING * 2;
      const scaleX = availW / room.width;
      const scaleY = availH / room.height;
      return Math.min(scaleX, scaleY) * zoom;
    },
    [room.width, room.height, zoom]
  );

  const worldToScreen = useCallback(
    (wx: number, wy: number, canvasW: number, canvasH: number) => {
      const scale = getScale(canvasW, canvasH);
      const roomPxW = room.width * scale;
      const roomPxH = room.height * scale;
      const offsetX = (canvasW - roomPxW) / 2 + pan.x;
      const offsetY = (canvasH - roomPxH) / 2 + pan.y;
      return {
        x: offsetX + wx * scale,
        y: offsetY + (room.height - wy) * scale,
      };
    },
    [room, getScale, pan]
  );

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
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const scale = getScale(w, h);
    const roomPxW = room.width * scale;
    const roomPxH = room.height * scale;
    const offsetX = (w - roomPxW) / 2 + pan.x;
    const offsetY = (h - roomPxH) / 2 + pan.y;

    // Background
    ctx.fillStyle = "#060a12";
    ctx.fillRect(0, 0, w, h);

    // Grid
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

    // Heatmap
    const cellSize = scale * 0.4;
    for (const cell of heatmap) {
      if (cell.intensity < 0.02) continue;
      const pos = worldToScreen(cell.x, cell.y, w, h);
      const alpha = Math.min(cell.intensity * 0.6, 0.7);
      const gradient = ctx.createRadialGradient(
        pos.x,
        pos.y,
        0,
        pos.x,
        pos.y,
        cellSize
      );
      gradient.addColorStop(0, `rgba(56,189,248,${alpha})`);
      gradient.addColorStop(1, "rgba(56,189,248,0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(
        pos.x - cellSize,
        pos.y - cellSize,
        cellSize * 2,
        cellSize * 2
      );
    }

    // Room floor
    ctx.fillStyle = "rgba(15,23,42,0.5)";
    ctx.fillRect(offsetX, offsetY, roomPxW, roomPxH);

    // Walls
    ctx.strokeStyle = "rgba(56,189,248,0.4)";
    ctx.lineWidth = 2;
    ctx.strokeRect(offsetX, offsetY, roomPxW, roomPxH);

    // Corner accents
    const cornerLen = 12;
    ctx.strokeStyle = "rgba(56,189,248,0.7)";
    ctx.lineWidth = 2;
    const corners = [
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
    for (const trail of trails) {
      const age = (now - trail.timestamp) / 5000;
      if (age > 1) continue;
      const pos = worldToScreen(trail.x, trail.y, w, h);
      const alpha = (1 - age) * trail.intensity * 0.8;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 3 * (1 - age * 0.5), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(56,189,248,${alpha})`;
      ctx.fill();
    }

    // Trail lines
    if (trails.length > 1) {
      ctx.beginPath();
      ctx.strokeStyle = "rgba(56,189,248,0.2)";
      ctx.lineWidth = 1.5;
      const recentTrails = trails.filter((t) => now - t.timestamp < 5000);
      for (let i = 0; i < recentTrails.length; i++) {
        const pos = worldToScreen(recentTrails[i].x, recentTrails[i].y, w, h);
        if (i === 0) ctx.moveTo(pos.x, pos.y);
        else ctx.lineTo(pos.x, pos.y);
      }
      ctx.stroke();
    }

    // Sensor pulse
    pulsePhase.current += 0.05;
    const pulseR = 8 + Math.sin(pulsePhase.current) * 4;

    const drawSensor = (
      sx: number,
      sy: number,
      label: string,
      color: string,
      icon: string
    ) => {
      const pos = worldToScreen(sx, sy, w, h);

      if (movementDetected) {
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, pulseR + 10, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(56,189,248,${0.15 + Math.sin(pulsePhase.current) * 0.1})`;
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
    drawSensor(
      room.receiver.x,
      room.receiver.y,
      "RECEIVER",
      "#8b5cf6",
      "📶"
    );

    // Smooth person position
    const lerpFactor = 0.15;
    smoothPos.current.x +=
      (personX - smoothPos.current.x) * lerpFactor;
    smoothPos.current.y +=
      (personY - smoothPos.current.y) * lerpFactor;

    if (personPresent) {
      const pos = worldToScreen(
        smoothPos.current.x,
        smoothPos.current.y,
        w,
        h
      );

      // Person glow
      const glow = ctx.createRadialGradient(
        pos.x,
        pos.y,
        0,
        pos.x,
        pos.y,
        20
      );
      glow.addColorStop(0, "rgba(52,211,153,0.3)");
      glow.addColorStop(1, "rgba(52,211,153,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(pos.x - 25, pos.y - 25, 50, 50);

      // Person body
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 8, 0, Math.PI * 2);
      ctx.fillStyle = personMoving ? "#34d399" : "#6ee7b7";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.4)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Direction arrow
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

        const headLen = 6;
        const angle1 = direction + Math.PI * 0.8;
        const angle2 = direction - Math.PI * 0.8;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(
          ax - Math.cos(angle1) * headLen,
          ay + Math.sin(angle1) * headLen
        );
        ctx.lineTo(
          ax - Math.cos(angle2) * headLen,
          ay + Math.sin(angle2) * headLen
        );
        ctx.closePath();
        ctx.fillStyle = "rgba(52,211,153,0.7)";
        ctx.fill();
      }

      ctx.fillStyle = "#94a3b8";
      ctx.font = "9px JetBrains Mono";
      ctx.textAlign = "center";
      ctx.fillText("ESTIMATED", pos.x, pos.y - 18);
    }

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
    room,
    personX,
    personY,
    personPresent,
    personMoving,
    direction,
    trails,
    heatmap,
    movementDetected,
    pan,
    getScale,
    worldToScreen,
  ]);

  useEffect(() => {
    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [draw]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => Math.max(0.5, Math.min(3, z - e.deltaY * 0.001)));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handleMouseUp = () => setDragging(false);

  return (
    <div
      ref={containerRef}
      className="glass-panel relative h-full w-full overflow-hidden"
      style={{ cursor: dragging ? "grabbing" : "grab" }}
    >
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
        <span className="font-mono text-[10px] tracking-wider text-slate-500 uppercase">
          Room Map
        </span>
        <span className="rounded bg-slate-800/80 px-1.5 py-0.5 font-mono text-[9px] text-slate-500">
          Drag to pan · Scroll to zoom
        </span>
      </div>
      <canvas
        ref={canvasRef}
        className="h-full w-full"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
    </div>
  );
}
