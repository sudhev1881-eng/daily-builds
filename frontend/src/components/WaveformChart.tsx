import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useMemo } from "react";

interface WaveformChartProps {
  waveform: number[];
}

export function WaveformChart({ waveform }: WaveformChartProps) {
  const data = useMemo(
    () => waveform.map((v, i) => ({ subcarrier: i, amplitude: v })),
    [waveform]
  );

  return (
    <div className="glass-panel flex h-full flex-col p-4">
      <h3 className="mb-2 font-mono text-xs tracking-wider text-slate-500 uppercase">
        CSI Amplitude Waveform
      </h3>
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="waveGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(56,189,248,0.08)"
            />
            <XAxis
              dataKey="subcarrier"
              tick={{ fill: "#475569", fontSize: 10, fontFamily: "monospace" }}
              axisLine={{ stroke: "rgba(56,189,248,0.1)" }}
              tickLine={false}
              label={{
                value: "Subcarrier",
                position: "insideBottom",
                offset: -2,
                style: { fill: "#475569", fontSize: 9, fontFamily: "monospace" },
              }}
            />
            <YAxis
              tick={{ fill: "#475569", fontSize: 10, fontFamily: "monospace" }}
              axisLine={{ stroke: "rgba(56,189,248,0.1)" }}
              tickLine={false}
              width={35}
            />
            <Tooltip
              contentStyle={{
                background: "rgba(15,23,42,0.9)",
                border: "1px solid rgba(56,189,248,0.2)",
                borderRadius: 8,
                fontFamily: "monospace",
                fontSize: 11,
              }}
            />
            <Area
              type="monotone"
              dataKey="amplitude"
              stroke="#38bdf8"
              strokeWidth={1.5}
              fill="url(#waveGradient)"
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
