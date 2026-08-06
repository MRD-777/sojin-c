"use client";
import { useEffect, useRef, useCallback } from "react";
import { useTheme } from "next-themes";

const DOT_COUNT = 25;
const CONNECT_DIST = 120;
const MOUSE_DIST = 180;
const CELL_SIZE = CONNECT_DIST;

export default function MouseBg() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const { resolvedTheme } = useTheme();
  const rafRef = useRef<number>(0);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const visibleRef = useRef(true);

  const color = resolvedTheme === "dark" ? "56,189,248" : "148,163,184";

  const handleMouse = useCallback((e: MouseEvent) => {
    mouseRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const ctx = c.getContext("2d", { alpha: true })!;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      c.width = window.innerWidth * dpr;
      c.height = window.innerHeight * dpr;
      c.style.width = `${window.innerWidth}px`;
      c.style.height = `${window.innerHeight}px`;
      ctx.scale(dpr, dpr);
    };
    resize();

    const w = () => window.innerWidth;
    const h = () => window.innerHeight;

    type Dot = { x: number; y: number; vx: number; vy: number; r: number; o: number };
    const dots: Dot[] = [];
    for (let i = 0; i < DOT_COUNT; i++) {
      dots.push({
        x: Math.random() * w(),
        y: Math.random() * h(),
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        r: Math.random() * 1.5 + 0.8,
        o: Math.random() * 0.3 + 0.08,
      });
    }

    // Spatial grid for O(n) neighbor lookups
    const getGrid = () => {
      const grid = new Map<string, Dot[]>();
      for (const d of dots) {
        const key = `${Math.floor(d.x / CELL_SIZE)},${Math.floor(d.y / CELL_SIZE)}`;
        const arr = grid.get(key);
        if (arr) arr.push(d);
        else grid.set(key, [d]);
      }
      return grid;
    };

    const draw = () => {
      if (!visibleRef.current) {
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      const ww = w(), hh = h();
      ctx.clearRect(0, 0, ww, hh);
      const mouse = mouseRef.current;

      // Update positions
      for (const d of dots) {
        const dx = mouse.x - d.x, dy = mouse.y - d.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < MOUSE_DIST) {
          d.vx += dx * 0.00006;
          d.vy += dy * 0.00006;
        }
        d.x += d.vx;
        d.y += d.vy;
        // Damping
        d.vx *= 0.999;
        d.vy *= 0.999;
        // Wrap
        if (d.x < 0) d.x = ww;
        if (d.x > ww) d.x = 0;
        if (d.y < 0) d.y = hh;
        if (d.y > hh) d.y = 0;

        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${color},${d.o})`;
        ctx.fill();
      }

      // Draw connections using spatial grid
      const grid = getGrid();
      const drawn = new Set<string>();

      for (const d of dots) {
        const cx = Math.floor(d.x / CELL_SIZE);
        const cy = Math.floor(d.y / CELL_SIZE);

        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            const neighbors = grid.get(`${cx + dx},${cy + dy}`);
            if (!neighbors) continue;
            for (const b of neighbors) {
              if (b === d) continue;
              const pairKey = d.x < b.x ? `${d.x},${d.y}-${b.x},${b.y}` : `${b.x},${b.y}-${d.x},${d.y}`;
              if (drawn.has(pairKey)) continue;
              drawn.add(pairKey);

              const dist = Math.sqrt((d.x - b.x) ** 2 + (d.y - b.y) ** 2);
              if (dist < CONNECT_DIST) {
                ctx.beginPath();
                ctx.moveTo(d.x, d.y);
                ctx.lineTo(b.x, b.y);
                ctx.strokeStyle = `rgba(${color},${0.08 * (1 - dist / CONNECT_DIST)})`;
                ctx.lineWidth = 0.8;
                ctx.stroke();
              }
            }
          }
        }
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    // Visibility API — pause when tab hidden
    const onVisibility = () => {
      visibleRef.current = !document.hidden;
    };
    document.addEventListener("visibilitychange", onVisibility);

    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", handleMouse, { passive: true });

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMouse);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [color, handleMouse]);

  return (
    <canvas
      ref={canvas}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ willChange: "transform" }}
    />
  );
}
