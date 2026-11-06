import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import Reel from "../components/Reel";
import { fixedSide, sideStyle, system, topics } from "../lib/data";
import { clearDraft, saveDraft, topicsWithDraft } from "../lib/storage";
import { ghostBtn, primaryBtn } from "../lib/ui";
import type { Side, Topic } from "../types";

type Stage = "topic" | "topicDone" | "side" | "done";

const shuffle = <T,>(list: T[]): T[] => {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const TOPIC_FILLERS = 22;
const SIDE_FILLERS = 14;

const pickSide = (topic: Topic): Side => fixedSide(topic) ?? (Math.random() < 0.5 ? "pro" : "con");

/** عناصر شريط الموقف: الأخير المختار يقع عند الفهرس SIDE_FILLERS */
function buildSideItems(side: Side): Side[] {
  const opposite: Side = side === "pro" ? "con" : "pro";
  return Array.from({ length: SIDE_FILLERS + 3 }, (_, i) => (i % 2 === 0 ? side : opposite));
}

/** يجهّز سحب القضية والموقف مسبقًا (دون آثار جانبية). `excludeId` يمنع تكرار القضية عند إعادة السحب. */
function makePlan(excludeId?: string) {
  const busy = new Set(topicsWithDraft());
  const free = topics.filter((t) => !busy.has(t.id));
  let pool = free.length > 0 ? free : topics;
  if (excludeId) {
    const rest = pool.filter((t) => t.id !== excludeId);
    if (rest.length > 0) pool = rest;
  }
  const topic: Topic = pool[Math.floor(Math.random() * pool.length)];
  const side = pickSide(topic);

  const others = shuffle(topics.filter((t) => t.id !== topic.id));
  const topicItems = [...others.slice(0, TOPIC_FILLERS), topic, ...others.slice(TOPIC_FILLERS, TOPIC_FILLERS + 2)];

  return { topic, side, topicItems, sideItems: buildSideItems(side), mustClear: free.length === 0 };
}

const heading: Record<Stage, string> = {
  topic: "جارٍ سحب القضية…",
  topicDone: "هذه قضيتك!",
  side: "والآن… مع أم ضد؟",
  done: "تم تحديد موقفك",
};

export default function NewTraining() {
  const nav = useNavigate();
  const [plan, setPlan] = useState(() => makePlan());
  const [spin, setSpin] = useState(0); // يتغير مع كل إعادة سحب ليعيد تشغيل الدولاب
  const [stage, setStage] = useState<Stage>("topic");
  const { topic, side } = plan;
  const style = sideStyle[side];

  const finish = useCallback(() => {
    if (plan.mustClear) clearDraft(topic.id);
    // الجلسة تقرأ الموقف من المسودة، فنحفظ الموقف الذي ظهر في الشريط
    saveDraft(topic.id, {
      side,
      step: 0,
      texts: ["", "", ""],
      opponents: ["", "", ""],
      sources: ["", "", ""],
    });
    nav(`/session/${topic.id}`, { replace: true });
  }, [nav, plan.mustClear, side, topic.id]);

  /** إعادة سحب القضية (وبعدها يُسحب الموقف من جديد عند المتابعة) */
  const respinTopic = () => {
    setPlan(makePlan(topic.id));
    setSpin((n) => n + 1);
    setStage("topic");
  };

  /** إعادة سحب الموقف فقط، وتبقى القضية كما هي */
  const respinSide = () => {
    const next = pickSide(topic);
    setPlan((p) => ({ ...p, side: next, sideItems: buildSideItems(next) }));
    setSpin((n) => n + 1);
    setStage("side");
  };

  const sideLocked = fixedSide(topic) !== null;

  const showSide = stage === "side" || stage === "done";

  return (
    <div
      className="relative flex min-h-[calc(100dvh-4rem)] flex-col items-center justify-center overflow-hidden px-6 pb-28 pt-8 text-center text-white"
      style={{
        backgroundColor: "var(--color-night)",
        backgroundImage:
          "radial-gradient(ellipse 80% 45% at 50% 100%, rgba(249,115,22,.28), transparent 70%), radial-gradient(ellipse 70% 40% at 100% 0%, rgba(225,29,72,.2), transparent 70%), radial-gradient(ellipse 70% 40% at 0% 0%, rgba(20,184,166,.18), transparent 70%)",
      }}
    >
      <p role="status" aria-live="polite" className="sr-only">
        {heading[stage]}
        {stage === "topicDone" && ` ${topic.title}`}
        {stage === "done" && ` فريق ${system.sides[side].label}`}
      </p>

      <h1 key={stage} className="fade-up font-display text-4xl font-bold text-flame-soft" aria-hidden="true">
        {heading[stage]}
      </h1>

      {/* بطاقة القضية بعد استقرارها */}
      {showSide && (
        <button
          type="button"
          onClick={respinTopic}
          disabled={stage !== "done"}
          aria-label={`${topic.title}. اضغط لإعادة سحب القضية`}
          className="btn fade-up mt-5 w-full max-w-sm rounded-2xl border border-white/15 bg-white/[.06] p-4 text-center enabled:hover:border-flame/60 enabled:active:border-flame enabled:active:bg-flame/25"
        >
          <p className="text-xs text-white/60">
            {topic.category} · {topic.difficulty}
            {stage === "done" && <span className="text-flame-soft"> · اضغط للتغيير</span>}
          </p>
          <p className="mt-1 font-display text-2xl font-bold leading-snug">{topic.title}</p>
        </button>
      )}

      <div className="mt-6 w-full">
        {!showSide && (
          <div
            onClick={stage === "topicDone" ? respinTopic : undefined}
            className={stage === "topicDone" ? "cursor-pointer" : undefined}
          >
            <Reel
              key={`topic-${spin}`}
              items={plan.topicItems.map((t) => (
                <span className="line-clamp-3 font-display text-xl font-bold leading-snug">{t.title}</span>
              ))}
              target={TOPIC_FILLERS}
              duration={4200}
              onLanded={() => setStage("topicDone")}
            />
            {stage === "topicDone" && (
              <p className="fade-up mx-auto mt-4 max-w-sm text-base leading-7 text-white/80">{topic.brief}</p>
            )}
          </div>
        )}

        {showSide && (
          <Reel
            key={`side-${spin}`}
            items={plan.sideItems.map((s) => (
              <span
                className={`rounded-xl px-8 py-2 font-display text-4xl font-bold ${
                  s === "pro" ? "bg-pro-soft text-pro" : "bg-con-soft text-con"
                }`}
              >
                {system.sides[s].label}
              </span>
            ))}
            target={SIDE_FILLERS}
            duration={2800}
            onLanded={() => setStage("done")}
          />
        )}

        {stage === "done" && (
          <button
            type="button"
            onClick={respinSide}
            disabled={sideLocked}
            aria-label={`ستدافع عن موقف ${system.sides[side].label}${sideLocked ? "" : ". اضغط لإعادة سحب الموقف"}`}
            className={`btn fade-up mt-4 rounded-xl px-4 py-1 text-xl font-bold enabled:active:bg-flame/20 ${style.text}`}
          >
            ستدافع عن موقف {system.sides[side].label}
            {!sideLocked && <span className="block text-xs font-normal text-white/60">اضغط للتغيير</span>}
          </button>
        )}
      </div>

      {stage === "topicDone" || stage === "done" ? (
        <div className="fade-up mt-8 flex w-full max-w-sm gap-3">
          {!(stage === "done" && sideLocked) && (
            <button
              type="button"
              onClick={stage === "done" ? respinSide : respinTopic}
              className={`${ghostBtn} min-h-12 flex-1 !rounded-2xl !text-base`}
            >
              إعادة
            </button>
          )}
          <button
            type="button"
            onClick={stage === "done" ? finish : () => setStage("side")}
            className={`${primaryBtn} shimmer min-h-12 flex-1 !rounded-2xl`}
          >
            متابعة
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={finish}
          className="btn mt-8 min-h-12 rounded-2xl border border-white/25 px-8 font-semibold text-white/80 hover:border-flame/60 active:border-flame active:bg-flame/25"
        >
          تخطَّ
        </button>
      )}
    </div>
  );
}
