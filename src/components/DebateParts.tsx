import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { sideStyle } from "../lib/data";
import { ghostBtn } from "../lib/ui";
import type { Side } from "../types";

export const ordinal = ["الأولى", "الثانية", "الثالثة"];

/** موجات صوتية صغيرة تتحرك أثناء الكلام */
export function Equalizer() {
  return (
    <span className="eq" aria-hidden="true">
      <span />
      <span />
      <span />
      <span />
    </span>
  );
}

/** بطاقة متحدث بلون فريقه، وعلامة «يتكلم الآن» تنبض أثناء ظهور النص */
export function SpeakerCard(props: {
  side: Side;
  label: string;
  speaking: boolean;
  busy?: boolean;
  badge?: ReactNode;
  children: ReactNode;
}) {
  const st = sideStyle[props.side];
  return (
    <section
      aria-busy={props.busy}
      className={`fade-up rounded-2xl border border-line border-s-4 bg-card p-4 transition-shadow duration-500 ${st.border} ${
        props.speaking ? st.glow : ""
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={`rounded-full px-3 py-1 text-sm font-bold ${st.badge}`}>{props.label}</span>
        <span className="flex items-center gap-2 text-xs">
          {props.speaking && (
            <span className={`flex items-center gap-1 font-semibold ${st.text}`}>
              <Equalizer />
              يتكلم الآن
            </span>
          )}
          {props.badge}
        </span>
      </div>
      <div className="mt-3 min-h-16">{props.children}</div>
    </section>
  );
}

/** حلقة تمتلئ مع عدد الأحرف */
export function Ring(props: { value: number; max: number; ok: boolean }) {
  const r = 18;
  const c = 2 * Math.PI * r;
  const p = Math.min(1, props.value / props.max);
  return (
    <svg viewBox="0 0 44 44" width="44" height="44" role="img" aria-label={`${props.value} من ${props.max} حرفًا`}>
      <circle cx="22" cy="22" r={r} fill="none" stroke="var(--color-line)" strokeWidth="4" />
      <circle
        cx="22"
        cy="22"
        r={r}
        fill="none"
        stroke={props.ok ? "var(--color-pro)" : "var(--color-flame)"}
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - p)}
        transform="rotate(-90 22 22)"
      />
    </svg>
  );
}

/** مؤقت تصاعدي اختياري، لا يفترض مدة معينة لأن قواعد المسابقة لم تُثبَّت بعد */
export function Stopwatch() {
  const [on, setOn] = useState(false);
  const [s, setS] = useState(0);
  useEffect(() => {
    if (!on) return;
    const id = setInterval(() => setS((v) => v + 1), 1000);
    return () => clearInterval(id);
  }, [on]);
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return (
    <div className="flex items-center gap-2">
      <span dir="ltr" className="font-mono text-sm tabular-nums">
        {mm}:{ss}
      </span>
      <button type="button" onClick={() => setOn((v) => !v)} className={ghostBtn}>
        {on ? "أوقف" : s ? "تابع" : "ابدأ المؤقت"}
      </button>
      {s > 0 && (
        <button
          type="button"
          onClick={() => {
            setOn(false);
            setS(0);
          }}
          className={ghostBtn}
        >
          صفّر
        </button>
      )}
    </div>
  );
}

/**
 * نص يُقرأ بصوت مسموع: reveal=true يُظهر ما نُطق فقط (يظهر النص مع الكلام)،
 * و reveal=false يُظهر النص كله ويُبرز الجزء المنطوق (إعادة الاستماع).
 */
export function SpokenText(props: { text: string; progress: number; reveal: boolean }) {
  const { text, progress, reveal } = props;
  let end = Math.min(text.length, Math.max(0, Math.round(progress)));
  // نكمل حتى نهاية الكلمة الحالية حتى لا تظهر كلمة مقطوعة
  while (end < text.length && !/\s/.test(text[end])) end++;
  const spoken = text.slice(0, end);
  const rest = text.slice(end);
  return (
    <>
      <p className="sr-only">{text}</p>
      <p aria-hidden="true" className="whitespace-pre-wrap leading-8">
        {spoken}
        {reveal ? (
          <span className="animate-pulse">▍</span>
        ) : (
          <span className="text-muted">{rest}</span>
        )}
      </p>
    </>
  );
}

/** زر الميكروفون: كرة كبيرة تنبض أثناء التسجيل */
export function MicButton(props: { listening: boolean; onToggle: () => void; disabled?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={props.onToggle}
        disabled={props.disabled}
        aria-pressed={props.listening}
        aria-label={props.listening ? "أوقف التسجيل" : "ابدأ التحدث"}
        className={`btn flex h-28 w-28 items-center justify-center rounded-full border-4 text-5xl disabled:opacity-40 ${
          props.listening
            ? "mic-live border-con bg-con text-night active:bg-con/70"
            : "float border-flame-soft bg-flame text-night shadow-[0_10px_36px_rgba(249,115,22,.6)] hover:bg-[#ff8a3d] active:bg-flame-deep active:text-white active:shadow-none"
        }`}
      >
        {props.listening ? (
          <span className="inline-block scale-[2.4]">
            <Equalizer />
          </span>
        ) : (
          <span aria-hidden="true">🎤</span>
        )}
      </button>
      <span className={`text-base font-bold ${props.listening ? "text-con" : "text-flame-soft"}`}>
        {props.listening ? "أستمع إليك… اضغط للإيقاف" : "اضغط وتحدّث"}
      </span>
    </div>
  );
}
