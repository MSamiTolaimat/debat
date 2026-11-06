import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

export const REEL_ROW = 100;

export const prefersReducedMotion = () =>
  typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * شريط عمودي يدور بسرعة ثم يتباطأ ويستقر على العنصر رقم `target` في منتصف النافذة.
 * يظهر 3 صفوف: السابق، المختار، التالي.
 */
export default function Reel(props: {
  items: ReactNode[];
  target: number;
  duration: number;
  onLanded: () => void;
}) {
  const { items, target, duration } = props;
  const reduce = useMemo(prefersReducedMotion, []);
  const [go, setGo] = useState(false);
  const [landed, setLanded] = useState(false);
  const cb = useRef(props.onLanded);
  cb.current = props.onLanded;

  useEffect(() => {
    // إطاران: ليسجّل المتصفح الوضع الابتدائي قبل بدء الانتقال
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setGo(true)));
    const t = setTimeout(
      () => {
        setLanded(true);
        try {
          navigator.vibrate?.(35);
        } catch {
          /* غير مدعوم */
        }
        cb.current();
      },
      reduce ? 450 : duration + 120
    );
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, [duration, reduce]);

  const mask = "linear-gradient(to bottom, transparent 0%, #000 30%, #000 70%, transparent 100%)";

  return (
    <div
      aria-hidden="true"
      className="relative mx-auto w-full max-w-sm overflow-hidden"
      style={{ height: REEL_ROW * 3, WebkitMaskImage: mask, maskImage: mask }}
    >
      {/* إطار الصف المختار */}
      <div
        className={`pointer-events-none absolute inset-x-0 z-10 rounded-2xl border-2 border-flame/80 bg-white/[.06] ${
          landed ? "reel-flash" : ""
        }`}
        style={{ top: REEL_ROW, height: REEL_ROW }}
      />
      <span
        className="pointer-events-none absolute z-10 text-flame"
        style={{ top: REEL_ROW + REEL_ROW / 2 - 14, insetInlineStart: 2, fontSize: 22 }}
      >
        ◂
      </span>
      <span
        className="pointer-events-none absolute z-10 text-flame"
        style={{ top: REEL_ROW + REEL_ROW / 2 - 14, insetInlineEnd: 2, fontSize: 22 }}
      >
        ▸
      </span>

      <div
        style={{
          transform: `translateY(${go ? -(target - 1) * REEL_ROW : 0}px)`,
          filter: go && !reduce ? "blur(0px)" : reduce ? "none" : "blur(3px)",
          transition: reduce
            ? "none"
            : `transform ${duration}ms cubic-bezier(.1,.72,.12,1), filter ${duration}ms ease-in`,
          willChange: "transform",
        }}
      >
        {items.map((node, i) => (
          <div
            key={i}
            className={`flex items-center justify-center px-6 text-center transition-opacity duration-500 ${
              landed && i !== target ? "opacity-30" : ""
            }`}
            style={{ height: REEL_ROW }}
          >
            {node}
          </div>
        ))}
      </div>
    </div>
  );
}
