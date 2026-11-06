import { useEffect, useRef } from "react";

const COLORS = ["#2dd4bf", "#f97316", "#fb7185", "#fbbf24", "#fdba74", "#ffffff"];

interface Piece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  rot: number;
  vr: number;
  color: string;
}

/** احتفال قصير بالقصاصات الملونة عند إنهاء مناظرة. لا يعمل مع تفضيل تقليل الحركة. */
export default function Confetti({ onDone }: { onDone?: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      onDone?.();
      return;
    }
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const W = window.innerWidth;
    const pieces: Piece[] = Array.from({ length: 150 }, (_, i) => {
      const fromLeft = i % 2 === 0;
      return {
        x: fromLeft ? -10 : W + 10,
        y: window.innerHeight * (0.55 + Math.random() * 0.2),
        vx: (fromLeft ? 1 : -1) * (4 + Math.random() * 9),
        vy: -(9 + Math.random() * 11),
        w: 6 + Math.random() * 6,
        h: 8 + Math.random() * 8,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.4,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
      };
    });

    let raf = 0;
    const start = performance.now();
    const frame = (now: number) => {
      const t = now - start;
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      const fade = t > 2200 ? Math.max(0, 1 - (t - 2200) / 800) : 1;
      for (const p of pieces) {
        p.vy += 0.38;
        p.vx *= 0.992;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      if (t < 3000) raf = requestAnimationFrame(frame);
      else onDone?.();
    };
    raf = requestAnimationFrame(frame);
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <canvas ref={ref} aria-hidden="true" className="pointer-events-none fixed inset-0 z-50 h-full w-full" />;
}
