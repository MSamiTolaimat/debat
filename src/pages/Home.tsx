import { Link, useNavigate } from "react-router-dom";
import { loadAiSettings } from "../lib/gemini";
import { loadSessions, topicsWithDraft } from "../lib/storage";

function Scales() {
  return (
    <svg
      viewBox="0 0 120 100"
      width="96"
      height="80"
      aria-hidden="true"
      className="float drop-shadow-[0_8px_18px_rgba(249,115,22,.45)]"
    >
      <path
        d="M60 14v70M38 86h44"
        stroke="#fff"
        strokeWidth="5"
        strokeLinecap="round"
        opacity=".9"
      />
      <path
        d="M22 28 60 20l38 8"
        stroke="#fff"
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
        opacity=".9"
      />
      <path
        d="M22 28 8 58h28zM98 28 84 58h28z"
        fill="none"
        stroke="#fff"
        strokeWidth="3"
        strokeLinejoin="round"
        opacity=".5"
      />
      <path d="M6 58a16 10 0 0 0 32 0z" fill="#14b8a6" />
      <path d="M82 58a16 10 0 0 0 32 0z" fill="#e11d48" />
      <circle cx="60" cy="14" r="6" fill="#f97316" />
    </svg>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const unfinished = topicsWithDraft()[0];
  // عدد المناظرات المكتملة (التدريبات القديمة بلا teamId تُعدّ كل جلسة منها واحدة)
  const done = new Set(loadSessions().map((s) => s.teamId ?? s.id)).size;
  const startTraining = () => {
    navigate(loadAiSettings()?.key ? "/new" : "/settings");
  };

  return (
    <div
      className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))] text-center text-white"
      style={{
        backgroundColor: "var(--color-night)",
        backgroundImage:
          "radial-gradient(ellipse 80% 45% at 50% 100%, rgba(249,115,22,.30), transparent 70%), radial-gradient(ellipse 70% 40% at 100% 0%, rgba(225,29,72,.22), transparent 70%), radial-gradient(ellipse 70% 40% at 0% 0%, rgba(20,184,166,.20), transparent 70%)",
      }}
    >
      <div
        className="orb -start-10 top-24 h-48 w-48 bg-pro/25"
        aria-hidden="true"
      />
      <div
        className="orb -end-10 top-1/2 h-56 w-56 bg-con/20"
        style={{ animationDelay: "-4s" }}
        aria-hidden="true"
      />
      <div className="relative z-10 flex flex-col items-center">
        <Scales />
        <p className="mt-3 font-display text-5xl font-bold tracking-wide text-flame-soft">
          مناظرة
        </p>

        <p className="mt-5 max-w-sm text-lg leading-8 text-white/80">
          تدرّب على المناظرة بصوتك أو بالكتابة: تسحب قضية وموقفًا، وتواجه خصمًا
          لا يجامل، ثم تعرف أين تتحسّن.
        </p>

        <button
          type="button"
          onClick={startTraining}
          className="btn shimmer mt-8 flex min-h-16 w-full max-w-sm items-center justify-center gap-2 rounded-2xl bg-flame px-8 text-xl font-bold text-night shadow-[0_10px_30px_rgba(249,115,22,.45)] hover:bg-[#ff8a3d] hover:shadow-[0_14px_38px_rgba(249,115,22,.6)] active:bg-flame-deep active:text-white active:shadow-none"
        >
          ابدأ التدريب
        </button>

        {done > 0 && (
          <p className="fade-up mt-4 rounded-full border border-white/15 bg-white/[.06] px-4 py-1 text-sm text-flame-soft">
            أكملتَ{" "}
            {done === 1
              ? "مناظرة واحدة"
              : done === 2
                ? "مناظرتين"
                : `${done} مناظرات`}
            . كمّل التقدم!
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

        <a
          href="https://t.me/Sami_Tulaimat"
          target="_blank"
          rel="noopener noreferrer"
          dir="ltr"
          className="mt-8 text-xs text-white/45 underline underline-offset-4 active:text-flame"
        >
          Sami Tolaimat · Telegram
        </a>
      </div>
    </div>
  );
}
