import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { useMemo } from "react";

interface SignalGraphProps {
  data: { time: string; rssi: number }[];
}

export function SignalGraph({ data }: SignalGraphProps) {
  const chartData = useMemo(() => data.slice(-60), [data]);

  return (
    <div className="glass-panel flex h-full flex-col p-4">
      <h3 className="mb-2 font-mono text-xs tracking-wider text-slate-500 uppercase">
        RSSI Signal Strength (dBm)
      </h3>
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(56,189,248,0.08)"
            />
            <XAxis
              dataKey="time"
              tick={{ fill: "#475569", fontSize: 10, fontFamily: "monospace" }}
              axisLine={{ stroke: "rgba(56,189,248,0.1)" }}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[-95, -30]}
              tick={{ fill: "#475569", fontSize: 10, fontFamily: "monospace" }}
              axisLine={{ stroke: "rgba(56,189,248,0.1)" }}
              tickLine={false}
              width={40}
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
            <ReferenceLine y={-70} stroke="rgba(251,191,36,0.3)" strokeDasharray="4 4" />
            <Line
              type="monotone"
              dataKey="rssi"
              stroke="#38bdf8"
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
