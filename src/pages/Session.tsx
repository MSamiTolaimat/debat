import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { fixedSide, getTopic, previousTurn, sideStyle, system, turnLabel } from "../lib/data";
import { loadAiSettings } from "../lib/gemini";
import { bankSpeech, generateOpponentSpeech, pickVariant, variantCount } from "../lib/opponent";
import { clearDraft, loadDraft, newId, saveDraft, saveSession } from "../lib/storage";
import type { Draft } from "../lib/storage";
import { field, ghostBtn, primaryBtn } from "../lib/ui";
import type { Side, Topic } from "../types";

const MIN_CHARS = 30;

type Source = "ai" | "bank" | "manual" | "";

const sourceLabel: Record<Exclude<Source, "">, string> = {
  ai: "ولّدها الذكاء الاصطناعي",
  bank: "نص جاهز",
  manual: "ألصقتها أنت",
};

function freshDraft(topic: Topic | undefined): Draft {
  const side: Side = fixedSide(topic) ?? (Math.random() < 0.5 ? "pro" : "con");
  return {
    side,
    step: 0,
    texts: ["", "", ""],
    opponents: ["", "", ""],
    sources: ["", "", ""],
  };
}

const setAt = <T,>(list: T[], i: number, v: T) => list.map((x, j) => (j === i ? v : x));

/** يُظهر النص كلمة كلمة كأن شخصًا يتكلم. النص الكامل متاح لقارئ الشاشة منذ البداية. */
function Typewriter(props: { text: string; onFinish: () => void }) {
  const tokens = useMemo(() => props.text.split(/(\s+)/), [props.text]);
  const reduce = useMemo(
    () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
    []
  );
  const [n, setN] = useState(reduce ? tokens.length : 0);
  const finish = useRef(props.onFinish);
  finish.current = props.onFinish;

  useEffect(() => {
    if (n >= tokens.length) {
      finish.current();
      return;
    }
    const id = setTimeout(() => setN((v) => Math.min(tokens.length, v + 2)), 90);
    return () => clearTimeout(id);
  }, [n, tokens.length]);

  return (
    <>
      <p className="sr-only">{props.text}</p>
      <p aria-hidden="true" className="whitespace-pre-wrap leading-8">
        {tokens.slice(0, n).join("")}
        {n < tokens.length && <span className="animate-pulse">▍</span>}
      </p>
    </>
  );
}

export default function SessionPage() {
  const { topicId } = useParams();
  // المفتاح يعيد بناء الصفحة عند تغيّر الموضوع، فلا تبقى مسودة موضوع سابق ولا موقفه
  return <SessionInner key={topicId} />;
}

function SessionInner() {
  const { topicId } = useParams();
  const nav = useNavigate();
  const topic = topicId ? getTopic(topicId) : undefined;

  const [initial] = useState<Draft>(() => {
    const saved = topicId ? loadDraft(topicId) : undefined;
    const fixed = fixedSide(topic);
    // مسودة قديمة بموقف يخالف المفروض حاليًا تُهمل (مثلًا بعد تغيير موقف الموضوع)
    return saved && (!fixed || saved.side === fixed) ? saved : freshDraft(topic);
  });
  const [restored] = useState(() => initial.texts.some((t) => t.length > 0));
  const side = initial.side;
  const [step, setStep] = useState(initial.step);
  const [texts, setTexts] = useState(initial.texts);
  const [opponents, setOpponents] = useState(initial.opponents);
  const [sources, setSources] = useState<Source[]>(
    () => (initial.sources ?? ["", "", ""]).map((s) => (s === "ai" || s === "bank" || s === "manual" ? s : "")) as Source[]
  );
  const [variant, setVariant] = useState<number | undefined>(initial.variant);
  const [busyStep, setBusyStep] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  const [typing, setTyping] = useState<number | null>(null);
  const [showManual, setShowManual] = useState(false);
  const requested = useRef<Set<number>>(new Set());

  const teamTurns = system.order.filter((t) => t.side === side);
  const turn = teamTurns[step];
  const prev = previousTurn(turn.id);

  useEffect(() => {
    if (topic && topicId) saveDraft(topicId, { side, step, texts, opponents, sources, variant });
  }, [topic, topicId, side, step, texts, opponents, sources, variant]);

  // عند الوصول إلى كلمة لها خصم سابق ولا نص له بعد، نجلب كلامه تلقائيًا
  useEffect(() => {
    if (!topic || !prev || opponents[step].trim() || requested.current.has(step)) return;
    requested.current.add(step);
    void fetchOpponent(step, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic, step]);

  async function fetchOpponent(forStep: number, regenerate: boolean) {
    const opTurn = previousTurn(teamTurns[forStep].id);
    if (!topic || !opTurn) return;
    setBusyStep(forStep);
    setNotice("");
    setShowManual(false);

    let text = "";
    let source: Source = "";
    let note = "";

    const ai = loadAiSettings();
    const aiReady = !!ai?.key && ai.consent;
    if (aiReady && ai) {
      try {
        // نبني سجل المناظرة حتى هذه اللحظة: كلمات الطالب السابقة وكلمات الخصم السابقة
        const known = new Map<string, string>();
        for (let j = 0; j < forStep; j++) {
          if (texts[j].trim()) known.set(teamTurns[j].id, texts[j].trim());
          const p = previousTurn(teamTurns[j].id);
          if (p && opponents[j].trim()) known.set(p.id, opponents[j].trim());
        }
        const idx = system.order.findIndex((t) => t.id === opTurn.id);
        const transcript = system.order
          .slice(0, idx)
          .filter((t) => known.has(t.id))
          .map((t) => ({ turn: t, text: known.get(t.id)! }));
        text = await generateOpponentSpeech(ai, { topic, turn: opTurn, studentSide: side, transcript });
        source = "ai";
      } catch (e) {
        note = (e instanceof Error ? e.message : "تعذر توليد كلمة الخصم.") + " ";
      }
    }

    if (!text) {
      const n = variantCount(topic, opTurn.side);
      if (n > 0) {
        let v = variant;
        if (regenerate || v === undefined || v >= n) v = pickVariant(n, regenerate ? variant : undefined);
        const banked = bankSpeech(topic, opTurn.side, opTurn.speaker, v);
        if (banked) {
          text = banked;
          source = "bank";
          setVariant(v);
        }
      }
      if (!text) {
        const sample = topic.sampleSpeech?.[opTurn.side];
        if (sample) {
          text = sample;
          source = "bank";
        }
      }
    }

    if (text) {
      setOpponents((o) => setAt(o, forStep, text));
      setSources((s) => setAt<Source>(s, forStep, source));
      setTyping(forStep);
      if (source === "bank") {
        setNotice(
          aiReady
            ? `${note}وُضع نص جاهز من البنك بدلًا منه.`
            : "لا يوجد مفتاح Gemini مفعّل، فهذا نص جاهز. أضف مفتاحك من الإعدادات ليتغير الكلام كل مرة ويردّ على ما تكتبه."
        );
      } else {
        setNotice("");
      }
    } else {
      setNotice(
        `${note}لا يوجد نص جاهز لهذا الموضوع. ألصق كلمة الخصم بنفسك، أو أضف مفتاح Gemini من الإعدادات ليولّدها الموقع.`
      );
    }
    setBusyStep((b) => (b === forStep ? null : b));
  }

  if (!topic) {
    return (
      <p>
        الموضوع غير موجود. <Link to="/topics" className="underline">ارجع إلى المواضيع</Link>
      </p>
    );
  }

  const role = system.roles[String(turn.speaker)];
  const text = texts[step];
  const canContinue = text.trim().length >= MIN_CHARS;
  const style = sideStyle[side];
  const isLast = step === teamTurns.length - 1;
  const oppText = opponents[step];
  const oppSource = sources[step];
  const loading = busyStep === step;

  const go = (n: number) => {
    setStep(n);
    setTyping(null);
    setShowManual(false);
    setNotice("");
    window.scrollTo(0, 0);
  };

  const finish = () => {
    const teamId = newId();
    const createdAt = new Date().toISOString();
    teamTurns.forEach((t, i) =>
      saveSession({
        id: `${newId()}${i}`,
        teamId,
        topicId: topic.id,
        turnId: t.id,
        text: texts[i].trim(),
        opponentText: opponents[i].trim(),
        createdAt,
      })
    );
    clearDraft(topic.id);
    nav(`/team/${teamId}`);
  };

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm text-muted">{topic.category}</p>
        <h1 className="font-display text-3xl font-bold leading-snug">{topic.title}</h1>
        <p className="mt-2 text-muted">{topic.brief}</p>
        {restored && (
          <p className="mt-3 text-sm text-gold">استرجعنا مسودتك المحفوظة من آخر مرة.</p>
        )}
      </header>

      <section className={`rounded-lg p-4 ${style.solid}`}>
        <p className="text-sm opacity-80">الموقف المفروض عليك في هذا التدريب</p>
        <p className="font-display text-3xl font-bold">فريق {system.sides[side].label}</p>
        <p className="mt-1 text-sm opacity-90">
          تكتب كلمات فريقك الثلاث بالترتيب، ولا يمكن تغيير الموقف.
        </p>
      </section>

      <ol className="flex gap-2" aria-label="تقدمك">
        {teamTurns.map((t, i) => (
          <li
            key={t.id}
            aria-current={i === step ? "step" : undefined}
            className={`flex-1 rounded-lg border p-2 text-center text-sm ${
              i === step
                ? `${style.solid} font-semibold`
                : i < step
                  ? "border-line bg-card text-ink"
                  : "border-line bg-card text-muted"
            }`}
          >
            {turnLabel(t)}
          </li>
        ))}
      </ol>

      <section className={`rounded-lg border-s-4 bg-card p-4 ${style.border}`}>
        <h2 className="font-semibold">
          الكلمة {step + 1} من {teamTurns.length}: {turnLabel(turn)} ({role.title})
        </h2>
        <p className="mt-1 text-sm text-muted">{role.description}</p>
        <ul className="mt-3 list-disc space-y-1 ps-5 text-sm">
          {role.tasks.map((task) => (
            <li key={task}>{task}</li>
          ))}
        </ul>
        {role.todo && <p className="mt-3 text-sm text-gold">{role.todo}</p>}
      </section>

      {step > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-muted">كلمات فريقك السابقة</h2>
          {teamTurns.slice(0, step).map((t, i) => (
            <details key={t.id} className="rounded-lg border border-line bg-card p-3">
              <summary className="cursor-pointer text-sm font-semibold">{turnLabel(t)}</summary>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-8">{texts[i]}</p>
            </details>
          ))}
        </section>
      )}

      {prev && (
        <section
          aria-busy={loading}
          className={`rounded-lg border border-line border-s-4 bg-card p-4 ${sideStyle[prev.side].border}`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">كلمة {turnLabel(prev)} (الخصم السابق)</h2>
            {oppText.trim() && oppSource && (
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${sideStyle[prev.side].badge}`}>
                {sourceLabel[oppSource]}
              </span>
            )}
          </div>

          <div className="mt-3 min-h-16">
            {loading ? (
              <p role="status" className="animate-pulse text-muted">
                {turnLabel(prev)} يستعد للكلام…
              </p>
            ) : oppText.trim() ? (
              typing === step ? (
                <Typewriter key={oppText} text={oppText} onFinish={() => setTyping(null)} />
              ) : (
                <p className="whitespace-pre-wrap leading-8">{oppText}</p>
              )
            ) : (
              <p className="text-sm text-muted">لا توجد كلمة للخصم بعد.</p>
            )}
          </div>

          {notice && !loading && <p className="mt-3 text-sm text-gold">{notice}</p>}

          <div className="mt-4 flex flex-wrap gap-2">
            {typing === step && !loading && (
              <button type="button" onClick={() => setTyping(null)} className={ghostBtn}>
                أظهر الكل
              </button>
            )}
            <button
              type="button"
              disabled={loading}
              onClick={() => void fetchOpponent(step, true)}
              className={ghostBtn}
            >
              {oppText.trim() ? "كلمة أخرى" : "حاول مرة أخرى"}
            </button>
            {oppText.trim() && !loading && (
              <button type="button" onClick={() => setShowManual((v) => !v)} className={ghostBtn}>
                {showManual ? "إخفاء الحقل" : "عدّل أو ألصق كلمة بنفسك"}
              </button>
            )}
          </div>

          {(showManual || (!oppText.trim() && !loading)) && (
            <div className="mt-4">
              <label htmlFor="opp" className="text-sm font-semibold">
                ألصق كلمة الخصم (اختياري)
              </label>
              <textarea
                id="opp"
                rows={5}
                value={oppText}
                onChange={(e) => {
                  setOpponents((o) => setAt(o, step, e.target.value));
                  setSources((s) => setAt<Source>(s, step, "manual"));
                  setTyping(null);
                }}
                className={`${field} mt-2`}
              />
            </div>
          )}
        </section>
      )}

      <section>
        <label htmlFor="speech" className="text-lg font-semibold">
          اكتب كلمة {turnLabel(turn)}
        </label>
        <textarea
          id="speech"
          rows={12}
          maxLength={system.maxCharsPerSpeech}
          value={text}
          onChange={(e) => setTexts((t) => setAt(t, step, e.target.value))}
          className={`${field} mt-2`}
        />
        <p className="mt-1 text-sm text-muted">
          {text.length} من {system.maxCharsPerSpeech} حرفًا
        </p>

        <div className="mt-4 flex flex-wrap gap-3">
          {step > 0 && (
            <button type="button" onClick={() => go(step - 1)} className={ghostBtn}>
              الكلمة السابقة
            </button>
          )}
          {isLast ? (
            <button type="button" onClick={finish} disabled={!canContinue} className={primaryBtn}>
              أنهِ وانتقل إلى ملخص الفريق
            </button>
          ) : (
            <button type="button" onClick={() => go(step + 1)} disabled={!canContinue} className={primaryBtn}>
              الكلمة التالية
            </button>
          )}
        </div>
        {!canContinue && (
          <p className="mt-2 text-sm text-muted">اكتب {MIN_CHARS} حرفًا على الأقل لتنتقل.</p>
        )}
      </section>
    </div>
  );
}
