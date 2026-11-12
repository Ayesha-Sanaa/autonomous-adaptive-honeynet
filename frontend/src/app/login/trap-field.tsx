"use client";

import { useEffect, useRef } from "react";

// "from" is the direction attackers arrive from, always pointing away from the core.
const DECOYS = [
  { name: "cowrie", color: "45,212,191", fx: -0.75, fy: -0.8, from: 180, spread: 20 },
  { name: "web portal", color: "163,230,53", fx: 0.75, fy: -0.8, from: -75, spread: 20 },
  { name: "heralding", color: "56,189,248", fx: -0.75, fy: 0.8, from: 180, spread: 22 },
  { name: "dionaea", color: "244,114,182", fx: 0.75, fy: 0.8, from: 85, spread: 20 },
];
const SHIELD = 90;

function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
const TAGS = ["T1110.001", "T1078", "T1033", "T1595", "T1046"];
const AMBER = "229,169,61";
const DANGER = "240,97,109";
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

type Node = { x: number; y: number; name: string; color: string; flash: number; burst: number };
type Atk = {
  sx: number; sy: number; tx: number; ty: number; node: number;
  t0: number; dur: number; phase: number;
  trail: { x: number; y: number }[];
  caught: number; // 0 while travelling, else timestamp
  x: number; y: number;
};
type Tag = { x: number; y: number; t0: number; text: string; color: string };

function hex(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, rot = 0) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i + rot;
    const x = cx + r * Math.cos(a);
    const y = cy + r * Math.sin(a);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

export function TrapField() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0, h = 0, cx = 0, cy = 0, erx = 0, ery = 0, raf = 0, last = 0, nextSpawn = 0, shield = 0;
    let nodes: Node[] = [];
    let atks: Atk[] = [];
    let tags: Tag[] = [];

    function build() {
      const parent = canvas!.parentElement;
      if (!parent) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = parent.clientWidth;
      h = parent.clientHeight;
      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
      canvas!.style.width = `${w}px`;
      canvas!.style.height = `${h}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      cx = w * 0.5;
      cy = h * 0.64;
      const rx = Math.min(w * 0.36, 320);
      const ry = Math.min(h * 0.17, 130);
      erx = rx * 0.75 * Math.SQRT2;
      ery = ry * 0.8 * Math.SQRT2;
      nodes = DECOYS.map((d) => ({ x: cx + d.fx * rx, y: cy + d.fy * ry, name: d.name, color: d.color, flash: 0, burst: -9999 }));
      atks = [];
      tags = [];
    }

    function launch(now: number, sx: number, sy: number, node?: number) {
      let ni = node;
      if (ni === undefined) {
        let best = Infinity;
        nodes.forEach((n, i) => {
          const d = Math.hypot(n.x - sx, n.y - sy);
          if (d < best) { best = d; ni = i; }
        });
      }
      const n = nodes[ni ?? 0];
      const dist = Math.hypot(n.x - sx, n.y - sy);
      atks.push({
        sx, sy, tx: n.x, ty: n.y, node: ni ?? 0, t0: now,
        dur: (dist / (130 + Math.random() * 50)) * 1000,
        phase: Math.random() * 6, trail: [], caught: 0, x: sx, y: sy,
      });
    }

    function approach(i: number) {
      const d = DECOYS[i];
      const a = ((d.from + (Math.random() * 2 - 1) * d.spread) * Math.PI) / 180;
      const dx = Math.cos(a), dy = Math.sin(a);
      const n = nodes[i];
      let t = Infinity;
      if (dx > 0) t = Math.min(t, (w - n.x) / dx);
      if (dx < 0) t = Math.min(t, (0 - n.x) / dx);
      if (dy > 0) t = Math.min(t, (h - n.y) / dy);
      if (dy < 0) t = Math.min(t, (0 - n.y) / dy);
      return { sx: n.x + dx * (t + 90), sy: n.y + dy * (t + 90) };
    }

    function spawn(now: number) {
      const i = Math.floor(Math.random() * nodes.length);
      const p = approach(i);
      launch(now, p.sx, p.sy, i);
    }

    function step(now: number, dt: number) {
      for (const n of nodes) n.flash = Math.max(0, n.flash - dt * 0.0016);
      shield = Math.max(0, shield - dt * 0.0012);
      for (const a of atks) {
        if (a.caught) continue;
        const p = Math.min(1, (now - a.t0) / a.dur);
        const dx = a.tx - a.sx, dy = a.ty - a.sy;
        const len = Math.hypot(dx, dy) || 1;
        const wob = Math.sin(p * Math.PI * 3 + a.phase) * 6 * (1 - p);
        a.x = a.sx + dx * p + (-dy / len) * wob;
        a.y = a.sy + dy * p + (dx / len) * wob;
        a.trail.push({ x: a.x, y: a.y });
        if (a.trail.length > 24) a.trail.shift();
        if (p >= 1) {
          a.caught = now;
          nodes[a.node].flash = 1;
          nodes[a.node].burst = now;
          shield = 1;
          tags.push({
            x: a.tx, y: a.ty - 24, t0: now,
            text: TAGS[Math.floor(Math.random() * TAGS.length)],
            color: nodes[a.node].color,
          });
        }
      }
      atks = atks.filter((a) => !a.caught || now - a.caught < 500);
      tags = tags.filter((t) => now - t.t0 < 1800);
    }

    function draw(now: number) {
      ctx!.clearRect(0, 0, w, h);

      // the decoy layer: a plain ring that passes through every decoy
      ctx!.beginPath();
      ctx!.ellipse(cx, cy, erx, ery, 0, 0, Math.PI * 2);
      ctx!.setLineDash([2, 8]);
      ctx!.lineDashOffset = -now * 0.01;
      ctx!.strokeStyle = "rgba(154,164,178,0.2)";
      ctx!.lineWidth = 1;
      ctx!.stroke();
      ctx!.setLineDash([]);

      // protected core
      const pulse = 0.5 + 0.5 * Math.sin(now * 0.002);
      ctx!.strokeStyle = `rgba(${AMBER},${0.3 + shield * 0.5})`;
      ctx!.lineWidth = 1.5;
      ctx!.beginPath();
      ctx!.arc(cx, cy, 72, 0, Math.PI * 2);
      ctx!.stroke();
      ctx!.strokeStyle = `rgba(${AMBER},0.16)`;
      ctx!.setLineDash([6, 10]);
      ctx!.lineDashOffset = now * 0.01;
      ctx!.beginPath();
      ctx!.arc(cx, cy, 82, 0, Math.PI * 2);
      ctx!.stroke();
      ctx!.setLineDash([]);

      const g = ctx!.createRadialGradient(cx, cy, 4, cx, cy, 76);
      g.addColorStop(0, `rgba(${AMBER},${0.22 + pulse * 0.08 + shield * 0.25})`);
      g.addColorStop(1, `rgba(${AMBER},0)`);
      ctx!.fillStyle = g;
      ctx!.beginPath();
      ctx!.arc(cx, cy, 76, 0, Math.PI * 2);
      ctx!.fill();

      hex(ctx!, cx, cy, 50, now * 0.0003);
      ctx!.strokeStyle = `rgba(${AMBER},${0.2 + shield * 0.4})`;
      ctx!.lineWidth = 1;
      ctx!.stroke();

      hex(ctx!, cx, cy, 32, Math.PI / 6);
      ctx!.fillStyle = `rgba(${AMBER},0.14)`;
      ctx!.fill();
      ctx!.strokeStyle = `rgba(${AMBER},0.9)`;
      ctx!.lineWidth = 2;
      ctx!.stroke();

      // padlock
      ctx!.strokeStyle = `rgba(${AMBER},0.95)`;
      ctx!.lineWidth = 2;
      ctx!.beginPath();
      ctx!.arc(cx, cy - 3, 5, Math.PI, 0);
      ctx!.stroke();
      ctx!.fillStyle = `rgba(${AMBER},0.95)`;
      ctx!.fillRect(cx - 8, cy - 3, 16, 12);

      ctx!.font = `11px ${MONO}`;
      ctx!.textAlign = "center";
      ctx!.fillStyle = "rgba(154,164,178,0.95)";
      ctx!.fillText("real systems", cx, cy + 104);

      // decoys
      for (const n of nodes) {
        const ring = ((now * 0.0004 + n.x * 0.001) % 1);
        ctx!.strokeStyle = `rgba(${n.color},${(1 - ring) * 0.25})`;
        ctx!.lineWidth = 1;
        ctx!.beginPath();
        ctx!.arc(n.x, n.y, 14 + ring * 22, 0, Math.PI * 2);
        ctx!.stroke();

        const bk = (now - n.burst) / 800;
        if (bk >= 0 && bk < 1) {
          ctx!.strokeStyle = `rgba(${n.color},${(1 - bk) * 0.7})`;
          ctx!.lineWidth = 2;
          ctx!.beginPath();
          ctx!.arc(n.x, n.y, 14 + bk * 38, 0, Math.PI * 2);
          ctx!.stroke();
        }

        const r = 13 + n.flash * 5;
        const glow = ctx!.createRadialGradient(n.x, n.y, 2, n.x, n.y, 34);
        glow.addColorStop(0, `rgba(${n.color},${0.2 + n.flash * 0.5})`);
        glow.addColorStop(1, `rgba(${n.color},0)`);
        ctx!.fillStyle = glow;
        ctx!.beginPath();
        ctx!.arc(n.x, n.y, 34, 0, Math.PI * 2);
        ctx!.fill();

        hex(ctx!, n.x, n.y, r, Math.PI / 6);
        ctx!.fillStyle = `rgba(${n.color},0.22)`;
        ctx!.fill();
        ctx!.strokeStyle = `rgba(${n.color},0.95)`;
        ctx!.lineWidth = 1.5;
        ctx!.stroke();

        ctx!.fillStyle = `rgba(${n.color},0.95)`;
        ctx!.beginPath();
        ctx!.arc(n.x, n.y, 2.5, 0, Math.PI * 2);
        ctx!.fill();

        ctx!.font = `11px ${MONO}`;
        ctx!.fillStyle = `rgba(${n.color},0.95)`;
        ctx!.fillText(n.name, n.x, n.y + 36);
      }

      // attackers
      for (const a of atks) {
        if (a.caught) {
          const k = Math.min(1, (now - a.caught) / 500);
          ctx!.fillStyle = `rgba(${AMBER},${1 - k})`;
          ctx!.beginPath();
          ctx!.arc(a.tx, a.ty, 5 * (1 - k), 0, Math.PI * 2);
          ctx!.fill();
          continue;
        }
        for (let i = 1; i < a.trail.length; i++) {
          const t = i / a.trail.length;
          ctx!.strokeStyle = `rgba(${DANGER},${t * 0.55})`;
          ctx!.lineWidth = 1 + t * 2;
          ctx!.beginPath();
          ctx!.moveTo(a.trail[i - 1].x, a.trail[i - 1].y);
          ctx!.lineTo(a.trail[i].x, a.trail[i].y);
          ctx!.stroke();
        }
        const hg = ctx!.createRadialGradient(a.x, a.y, 0, a.x, a.y, 14);
        hg.addColorStop(0, `rgba(${DANGER},0.55)`);
        hg.addColorStop(1, `rgba(${DANGER},0)`);
        ctx!.fillStyle = hg;
        ctx!.beginPath();
        ctx!.arc(a.x, a.y, 14, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.fillStyle = `rgb(${DANGER})`;
        ctx!.beginPath();
        ctx!.arc(a.x, a.y, 3.5, 0, Math.PI * 2);
        ctx!.fill();
      }

      // technique tags rising from caught attackers
      ctx!.font = `600 12px ${MONO}`;
      for (const t of tags) {
        const k = (now - t.t0) / 1800;
        ctx!.fillStyle = `rgba(${t.color},${1 - k})`;
        ctx!.fillText(t.text, t.x, t.y - k * 34);
      }
    }

    function loop(now: number) {
      const dt = last ? Math.min(now - last, 64) : 16;
      last = now;
      if (now > nextSpawn && atks.filter((a) => !a.caught).length < 6) {
        spawn(now);
        nextSpawn = now + 900 + Math.random() * 900;
      }
      step(now, dt);
      draw(now);
      raf = requestAnimationFrame(loop);
    }

    function onDown(e: PointerEvent) {
      const el = e.target as HTMLElement | null;
      if (el?.closest("input,button,a,form")) return;
      const rect = canvas!.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (x < 0 || y < 0 || x > rect.width || y > rect.height) return;
      if (Math.hypot(x - cx, y - cy) < SHIELD) return;
      const order = nodes
        .map((n, i) => ({ i, d: Math.hypot(n.x - x, n.y - y) }))
        .sort((p, q) => p.d - q.d);
      const pick = order.find((o) => segDist(cx, cy, x, y, nodes[o.i].x, nodes[o.i].y) >= SHIELD);
      if (pick) launch(performance.now(), x, y, pick.i);
    }

    function staticDraw() {
      const now = performance.now();
      atks = [0, 3].map((i) => {
        const n = nodes[i];
        const { sx, sy } = approach(i);
        return {
          sx, sy, tx: n.x, ty: n.y, node: i, t0: now - 1000, dur: 2000, phase: 0,
          trail: [], caught: 0, x: sx + (n.x - sx) * 0.5, y: sy + (n.y - sy) * 0.5,
        };
      });
      draw(now);
    }

    build();
    const ro = new ResizeObserver(() => {
      build();
      if (reduce) staticDraw();
    });
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    if (reduce) {
      staticDraw();
    } else {
      window.addEventListener("pointerdown", onDown);
      raf = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("pointerdown", onDown);
    };
  }, []);

  return <canvas ref={ref} aria-hidden="true" className="absolute inset-0" />;
}
