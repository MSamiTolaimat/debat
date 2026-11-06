import { Link } from "react-router-dom";
import { loadSessions, topicsWithDraft } from "../lib/storage";

function Scales() {
  return (
    <svg viewBox="0 0 120 100" width="112" height="94" aria-hidden="true" className="float drop-shadow-[0_8px_18px_rgba(249,115,22,.45)]">
      <path d="M60 14v70M38 86h44" stroke="#fff" strokeWidth="5" strokeLinecap="round" opacity=".9" />
      <path d="M22 28 60 20l38 8" stroke="#fff" strokeWidth="4" strokeLinecap="round" fill="none" opacity=".9" />
      <path d="M22 28 8 58h28zM98 28 84 58h28z" fill="none" stroke="#fff" strokeWidth="3" strokeLinejoin="round" opacity=".5" />
      <path d="M6 58a16 10 0 0 0 32 0z" fill="#14b8a6" />
      <path d="M82 58a16 10 0 0 0 32 0z" fill="#e11d48" />
      <circle cx="60" cy="14" r="6" fill="#f97316" />
    </svg>
  );
}

const steps = [
  { n: "١", t: "موضوع وموقف بالقرعة" },
  { n: "٢", t: "اكتب كلماتك" },
  { n: "٣", t: "اعرف نقاط ضعفك" },
];

export default function Home() {
  const unfinished = topicsWithDraft()[0];
  // عدد المناظرات المكتملة (التدريبات القديمة بلا teamId تُعدّ كل جلسة منها واحدة)
  const done = new Set(loadSessions().map((s) => s.teamId ?? s.id)).size;
  return (
    <div
      className="relative flex min-h-[calc(100dvh-4rem)] flex-col items-center justify-center overflow-hidden px-6 pb-28 pt-10 text-center text-white"
      style={{
        backgroundColor: "var(--color-night)",
        backgroundImage:
          "radial-gradient(ellipse 80% 45% at 50% 100%, rgba(249,115,22,.30), transparent 70%), radial-gradient(ellipse 70% 40% at 100% 0%, rgba(225,29,72,.22), transparent 70%), radial-gradient(ellipse 70% 40% at 0% 0%, rgba(20,184,166,.20), transparent 70%)",
      }}
    >
      <div className="orb -start-10 top-24 h-48 w-48 bg-pro/25" aria-hidden="true" />
      <div className="orb -end-10 top-1/2 h-56 w-56 bg-con/20" style={{ animationDelay: "-4s" }} aria-hidden="true" />
      <div className="relative z-10 flex flex-col items-center">
      <Scales />
      <p className="mt-3 font-display text-3xl font-bold tracking-wide text-flame-soft">مناظرة</p>

      <h1 className="mt-6 font-display text-5xl font-bold leading-[1.25] sm:text-6xl">
        اكتب حجتك.
        <br />
        <span
          className="bg-clip-text text-transparent"
          style={{ backgroundImage: "linear-gradient(90deg,#f97316,#fbbf24,#f97316)" }}
        >
          واجه خصمك.
        </span>
      </h1>

      <p className="mt-5 max-w-sm text-lg leading-8 text-white/80">
        تدريب كتابي على المناظرة: تأخذ موقفًا، وتردّ على خصم، وتعرف أين تتحسن.
      </p>

      <Link
        to="/new"
        className="btn shimmer mt-9 flex min-h-16 w-full max-w-sm items-center justify-center gap-2 rounded-2xl bg-flame px-8 text-xl font-bold text-night shadow-[0_10px_30px_rgba(249,115,22,.45)] hover:bg-[#ff8a3d] hover:shadow-[0_14px_38px_rgba(249,115,22,.6)] active:bg-flame-deep active:text-white active:shadow-none"
      >
        <span aria-hidden="true">🔥</span>
        ابدأ التدريب
      </Link>

      {done > 0 && (
        <p className="fade-up mt-4 rounded-full border border-white/15 bg-white/[.06] px-4 py-1 text-sm text-flame-soft">
          أكملتَ {done === 1 ? "مناظرة واحدة" : done === 2 ? "مناظرتين" : `${done} مناظرات`}. كمّل التقدم!
        </p>
      )}

      {unfinished && (
        <Link
          to={`/session/${unfinished}`}
          className="btn mt-4 flex min-h-12 w-full max-w-sm items-center justify-center rounded-2xl border border-white/25 px-6 font-semibold text-white hover:border-flame/70 hover:bg-white/5 active:border-flame active:bg-flame/25 active:text-flame-soft"
        >
          أكمل تدريبك السابق
        </Link>
      )}

      <ol className="mt-10 flex w-full max-w-sm justify-between gap-2 text-sm text-white/75">
        {steps.map((s) => (
          <li key={s.n} className="flex flex-1 flex-col items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-flame/70 bg-flame/10 font-display text-lg font-bold text-flame">
              {s.n}
            </span>
            {s.t}
          </li>
        ))}
      </ol>

      <Link to="/about" className="mt-10 text-sm text-white/50 underline underline-offset-4 active:text-flame">
        عن النظام
      </Link>
      </div>
    </div>
  );
}
