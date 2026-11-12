"use client";

import { useEffect, useRef } from "react";

const R = 28; // hex radius in px
const SQ3 = Math.sqrt(3);
const AMBER = "229,169,61";

type Cell = { x: number; y: number };
type Ripple = { x: number; y: number; t0: number };

function hexPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i + Math.PI / 6;
    const px = cx + r * Math.cos(a);
    const py = cy + r * Math.sin(a);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

export function HexField() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0;
    let h = 0;
    let raf = 0;
    let cells: Cell[] = [];
    let ripples: Ripple[] = [];
    let lastSpawn = 0;
    const mouse = { x: -1000, y: -1000 };

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

      cells = [];
      const dx = SQ3 * R;
      const dy = 1.5 * R;
      for (let row = -1; row * dy < h + R * 2; row++) {
        for (let col = -1; col * dx < w + dx * 2; col++) {
          cells.push({ x: col * dx + (row % 2 ? dx / 2 : 0), y: row * dy });
        }
      }
    }

    function spawn(now: number) {
      if (!cells.length) return;
      const c = cells[Math.floor(Math.random() * cells.length)];
      ripples.push({ x: c.x, y: c.y, t0: now });
      if (ripples.length > 3) ripples.shift();
      lastSpawn = now;
    }

    function draw(now: number) {
      ctx!.clearRect(0, 0, w, h);
      const speed = 0.18; // px per ms
      const band = 70;
      const maxR = Math.max(w, h) * 0.9;
      ripples = ripples.filter((r) => (now - r.t0) * speed < maxR);

      for (const c of cells) {
        let glow = 0;
        for (const r of ripples) {
          const front = (now - r.t0) * speed;
          const d = Math.hypot(c.x - r.x, c.y - r.y);
          const off = Math.abs(d - front);
          if (off < band) {
            const fade = 1 - front / maxR;
            glow = Math.max(glow, (1 - off / band) * 0.85 * fade);
          }
        }
        const md = Math.hypot(c.x - mouse.x, c.y - mouse.y);
        if (md < 140) glow = Math.max(glow, (1 - md / 140) * 0.9);

        hexPath(ctx!, c.x, c.y, R - 1.5);
        ctx!.strokeStyle = "rgba(154,164,178,0.09)";
        ctx!.lineWidth = 1;
        ctx!.stroke();

        if (glow > 0.03) {
          ctx!.fillStyle = `rgba(${AMBER},${(glow * 0.16).toFixed(3)})`;
          ctx!.fill();
          ctx!.strokeStyle = `rgba(${AMBER},${(0.1 + glow * 0.6).toFixed(3)})`;
          ctx!.stroke();
        }
      }
    }

    function loop(now: number) {
      if (now - lastSpawn > 1600) spawn(now);
      draw(now);
      raf = requestAnimationFrame(loop);
    }

    function onMove(e: PointerEvent) {
      const rect = canvas!.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    }
    function onLeave() {
      mouse.x = -1000;
      mouse.y = -1000;
    }

    build();
    const ro = new ResizeObserver(() => {
      build();
      if (reduce) staticDraw();
    });
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    function staticDraw() {
      ripples = [{ x: w * 0.3, y: h * 0.45, t0: performance.now() - 1500 }];
      draw(performance.now());
    }

    if (reduce) {
      staticDraw();
    } else {
      window.addEventListener("pointermove", onMove);
      document.addEventListener("pointerleave", onLeave);
      raf = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return <canvas ref={ref} aria-hidden="true" className="absolute inset-0" />;
}
