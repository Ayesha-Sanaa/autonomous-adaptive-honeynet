"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatDay } from "@/lib/format";

export function TimelineChart({ data }: { data: { day: string; count: number }[] }) {
  return (
    <div className="h-64 w-full" role="img" aria-label="Events per day">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="fillTeal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2dd4bf" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#2dd4bf" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#1d2834" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="day" tickFormatter={formatDay} tick={{ fill: "#5d6c7b", fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={24} />
          <YAxis allowDecimals={false} tick={{ fill: "#5d6c7b", fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip
            cursor={{ stroke: "#2dd4bf", strokeOpacity: 0.3 }}
            contentStyle={{ background: "#141c25", border: "1px solid #1d2834", borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: "#8b9bab" }}
            itemStyle={{ color: "#e6edf3" }}
            labelFormatter={(d) => formatDay(String(d))}
            formatter={(v) => [v, "Events"]}
          />
          <Area type="monotone" dataKey="count" stroke="#2dd4bf" strokeWidth={2} fill="url(#fillTeal)" dot={false} activeDot={{ r: 4, fill: "#2dd4bf", stroke: "#080c11", strokeWidth: 2 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
