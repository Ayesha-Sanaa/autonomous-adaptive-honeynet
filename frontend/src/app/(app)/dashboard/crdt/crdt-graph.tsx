"use client";

import * as d3 from "d3";

type SharedIp = {
  ip: string;
  level: number;
  decoys: string[];
  total_events: number;
};

const DECOYS = ["cowrie", "web-portal", "heralding", "dionaea"];

const LEVEL_COLOR = d3
  .scaleOrdinal<number, string>()
  .domain([1, 2, 3, 4])
  .range(["#64748b", "#eab308", "#f97316", "#ef4444"]);

const LEVEL_LABEL: Record<number, string> = {
  1: "Connected",
  2: "Login attempt",
  3: "Login success",
  4: "Ran commands",
};

export default function CrdtGraph({ ips }: { ips: SharedIp[] }) {
  const width = 760;
  const rows = Math.max(ips.length, DECOYS.length);
  const height = Math.max(260, rows * 60);
  const leftX = 170;
  const rightX = width - 120;
  const midX = (leftX + rightX) / 2;

  const yIp = d3
    .scalePoint<string>()
    .domain(ips.map((i) => i.ip))
    .range([40, height - 40])
    .padding(0.3);

  const yDecoy = d3
    .scalePoint<string>()
    .domain(DECOYS)
    .range([40, height - 40])
    .padding(0.3);

  const links = ips.flatMap((i) =>
    i.decoys
      .filter((d) => DECOYS.includes(d))
      .map((d) => ({ ip: i.ip, decoy: d, level: i.level }))
  );

  if (ips.length === 0) {
    return <p className="text-sm text-muted">No attackers seen yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full min-w-[560px]"
        role="img"
        aria-label="Which decoys saw which attacker IP"
      >
        {links.map((l) => {
          const y1 = yIp(l.ip) ?? 0;
          const y2 = yDecoy(l.decoy) ?? 0;
          return (
            <path
              key={`${l.ip}-${l.decoy}`}
              d={`M${leftX},${y1} C${midX},${y1} ${midX},${y2} ${rightX},${y2}`}
              fill="none"
              stroke={LEVEL_COLOR(l.level)}
              strokeWidth={1.8}
              strokeOpacity={0.7}
            />
          );
        })}

        {ips.map((i) => {
          const y = yIp(i.ip) ?? 0;
          return (
            <g key={i.ip}>
              <title>{`${i.ip}: ${LEVEL_LABEL[i.level] ?? "Unknown"}, ${i.total_events} events`}</title>
              <circle cx={leftX} cy={y} r={7} fill={LEVEL_COLOR(i.level)} />
              <text x={leftX - 14} y={y + 4} textAnchor="end" className="fill-current font-mono text-[12px]">
                {i.ip}
              </text>
            </g>
          );
        })}

        {DECOYS.map((d) => {
          const y = yDecoy(d) ?? 0;
          return (
            <g key={d}>
              <rect x={rightX} y={y - 13} width={100} height={26} rx={6} fill="none" stroke="currentColor" strokeOpacity={0.35} />
              <text x={rightX + 50} y={y + 4} textAnchor="middle" className="fill-current text-[12px]">
                {d}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}