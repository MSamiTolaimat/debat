import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { fixedSide, getTopic, previousTurn, sideStyle, system, turnLabel } from "../lib/data";
import { loadAiSettings } from "../lib/gemini";
import { bankSpeech, generateOpponentSpeech, pickVariant, variantCount } from "../lib/opponent";
import { clearDraft, loadDraft, newId, saveDraft, saveSession } from "../lib/storage";
import type { Draft } from "../lib/storage";
import { field, ghostBtn, iconBtn, primaryBtn } from "../lib/ui";
import type { Side, Topic } from "../types";
import Arena from "../components/Arena";
import { MicButton, Ring, SpeakerCard, SpokenText, ordinal } from "../components/DebateParts";
import { loadVoice, ttsSupported, useArabicVoice, useDictation, useSpeaker } from "../lib/speech";
import { loadPrefs } from "../lib/prefs";

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
    const id = setTimeout(() => setN((v) => Math.min(tokens.length, v + 4)), 55);
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
  const requested = useRef<Set<number>>(new Set());
  // الكلمة الختامية للخصم بعد كلمة الطالب الأخيرة
  const [closing, setClosing] = useState(initial.closing ?? "");
  const [closingMode, setClosingMode] = useState(false);
  const [closingBusy, setClosingBusy] = useState(false);
  const [closingTyping, setClosingTyping] = useState(false);
  const [interlude, setInterlude] = useState("");
  const speechRef = useRef<HTMLTextAreaElement>(null);
  const captionRef = useRef<HTMLDivElement>(null);
  const oppRef = useRef<HTMLDivElement>(null);
  // الكتابة اليدوية خيار ثانوي: الكلمة تظهر كترجمة حية، والحقل يُفتح عند الطلب
  const [prefs] = useState(loadPrefs);
  const typeMode = prefs.replyMode === "type";
  const [editing, setEditing] = useState(typeMode);
  const focusEditor = useRef(false);
  const [voice] = useState(loadVoice);
  const speaker = useSpeaker();
  const arabicVoice = useArabicVoice();
  const canSpeak = ttsSupported();
  const dictation = useDictation({
    getText: () => texts[step],
    setText: (v) => setTexts((t) => setAt(t, step, v)),
    max: system.maxCharsPerSpeech,
  });

  /** يعرض كلمة الخصم: بصوت مسموع مع ظهور النص، أو بالكتابة التدريجية إن كان الصوت متوقفًا */
  function present(key: "closing" | number, text: string) {
    if (voice.autoSpeak && canSpeak && !dictation.listening) {
      setTyping(null);
      setClosingTyping(false);
      speaker.speakText(key === "closing" ? "closing" : `opp:${key}`, text, voice.rate, true);
    } else if (key === "closing") {
      setClosingTyping(true);
    } else {
      setTyping(key);
    }
  }

  useEffect(() => {
    if (dictation.listening && captionRef.current) captionRef.current.scrollTop = captionRef.current.scrollHeight;
  }, [dictation.listening, texts, step]);

  // أثناء قراءة الخصم يتبع النصُّ الصوتَ إلى الأسفل
  useEffect(() => {
    if (speaker.activeKey && speaker.reveal && oppRef.current) oppRef.current.scrollTop = oppRef.current.scrollHeight;
  }, [speaker.activeKey, speaker.reveal, speaker.progress]);

  // نركّز الحقل فقط عندما يفتحه المستخدم بنفسه، لا عند فتح الصفحة (حتى لا تظهر لوحة المفاتيح فجأة)
  useEffect(() => {
    if (editing && focusEditor.current) {
      speechRef.current?.focus();
      focusEditor.current = false;
    }
  }, [editing]);

  useEffect(() => {
    if (!interlude) return;
    const id = setTimeout(() => setInterlude(""), 700);
    return () => clearTimeout(id);
  }, [interlude]);

  const teamTurns = system.order.filter((t) => t.side === side);
  const turn = teamTurns[step];
  // أدوار الخصم التي تأتي بعد كلمة الطالب الأخيرة (فيكتمل التحدي حتى نهايته)
  const epilogue = system.order
    .slice(system.order.findIndex((t) => t.id === teamTurns[teamTurns.length - 1].id) + 1)
    .filter((t) => t.side !== side);
  const prev = previousTurn(turn.id);

  useEffect(() => {
    if (topic && topicId) saveDraft(topicId, { side, step, texts, opponents, sources, variant, closing });
  }, [topic, topicId, side, step, texts, opponents, sources, variant, closing]);

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
    speaker.stop();
    setBusyStep(forStep);
    setNotice("");

    let text = "";
    let source: Source = "";
    let note = "";

    const ai = loadAiSettings();
    const aiReady = !!ai?.key;
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
      present(forStep, text);
      if (source === "bank") {
        setNotice(note.trim());
      } else {
        setNotice("");
      }
    } else {
      setNotice(`${note}لا توجد كلمة للخصم. ألصقها بنفسك أو أعد المحاولة.`.trim());
    }
    setBusyStep((b) => (b === forStep ? null : b));
  }

  async function fetchClosing(regenerate: boolean) {
    const opTurn = epilogue[0];
    if (!topic || !opTurn) return;
    speaker.stop();
    setClosingBusy(true);
    setClosingTyping(false);
    setNotice("");
    let text = "";
    let note = "";
    const ai = loadAiSettings();
    const aiReady = !!ai?.key;
    if (aiReady && ai) {
      try {
        const known = new Map<string, string>();
        teamTurns.forEach((t, j) => {
          if (texts[j].trim()) known.set(t.id, texts[j].trim());
          const p = previousTurn(t.id);
          if (p && opponents[j].trim()) known.set(p.id, opponents[j].trim());
        });
        const idx = system.order.findIndex((t) => t.id === opTurn.id);
        const transcript = system.order
          .slice(0, idx)
          .filter((t) => known.has(t.id))
          .map((t) => ({ turn: t, text: known.get(t.id)! }));
        text = await generateOpponentSpeech(ai, { topic, turn: opTurn, studentSide: side, transcript });
      } catch (e) {
        note = (e instanceof Error ? e.message : "تعذر توليد الكلمة الختامية.") + " ";
      }
    }
    if (!text) {
      const n = variantCount(topic, opTurn.side);
      if (n > 0) {
        const v = regenerate || variant === undefined || variant >= n ? pickVariant(n, regenerate ? variant : undefined) : variant;
        text = bankSpeech(topic, opTurn.side, opTurn.speaker, v) ?? "";
        if (text) setVariant(v);
      }
      if (text) {
        setNotice(note.trim());
      } else {
        setNotice(note.trim());
      }
    }
    if (text) {
      setClosing(text);
      present("closing", text);
    }
    setClosingBusy(false);
  }

  if (!topic) {
    return (
      <p>
        الموضوع غير موجود. <Link to="/new" className="underline">ابدأ تدريبًا جديدًا</Link>
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
    dictation.stop();
    speaker.stop();
    setEditing(typeMode);
    setStep(n);
    setTyping(null);
    setNotice("");
    const p = previousTurn(teamTurns[n].id);
    setInterlude(`الجولة ${ordinal[n]}: ${p ? `${turnLabel(p)} يستعد…` : "أنت تفتح المناظرة"}`);
    window.scrollTo(0, 0);
  };

  const finish = () => {
    speaker.stop();
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
        closingText: i === teamTurns.length - 1 && closing.trim() ? closing.trim() : undefined,
      })
    );
    clearDraft(topic.id);
    nav(`/team/${teamId}`, { state: { fresh: true } });
  };

  const startClosing = () => {
    dictation.stop();
    if (epilogue.length === 0) return finish();
    setClosingMode(true);
    setNotice("");
    window.scrollTo(0, 0);
    if (!closing.trim()) void fetchClosing(false);
  };

  const backToEdit = () => {
    speaker.stop();
    setClosing(""); // نعيد توليدها لتردّ على النص بعد تعديله
    setClosingMode(false);
    setClosingTyping(false);
    setNotice("");
  };

  const oppKey = `opp:${step}`;
  const speakingOpp = speaker.activeKey === oppKey;
  const speakingClosing = speaker.activeKey === "closing";

  const oppBody = !prev ? null : loading ? (
    <p role="status" className="animate-pulse text-muted">
      {turnLabel(prev)} يستعد للكلام…
    </p>
  ) : oppText.trim() ? (
    speakingOpp ? (
      <SpokenText text={oppText} progress={speaker.progress} reveal={speaker.reveal} />
    ) : typing === step ? (
      <Typewriter key={oppText} text={oppText} onFinish={() => setTyping(null)} />
    ) : (
      <p className="whitespace-pre-wrap leading-8">{oppText}</p>
    )
  ) : (
    <p className="text-sm text-muted">لا توجد كلمة للخصم بعد.</p>
  );

  const phase = loading
    ? `${prev ? turnLabel(prev) : "الخصم"} يستعد…`
    : speakingOpp || typing === step
      ? "الخصم يتكلم"
      : dictation.listening
        ? "أنت تتكلم… كلامك يظهر أمامك"
        : prev
          ? "دورك! ردّ على الخصم"
          : "دورك! افتح المناظرة";
  const oppActive = loading || speakingOpp || typing === step;
  const arenaSpeaking: "you" | "opp" | null = oppActive && !loading ? "opp" : dictation.listening ? "you" : null;
  const showEditor = editing || !dictation.supported;

  if (closingMode && epilogue[0]) {
    const opTurn = epilogue[0];
    const talking = (closingTyping || speakingClosing) && !closingBusy;
    return (
      <div className="space-y-5">
        <header>
          <p className="text-xs font-semibold text-flame-soft">{topic.category}</p>
          <h1 className="font-display text-2xl font-bold leading-snug">{topic.title}</h1>
        </header>

        <Arena
          userSide={side}
          active="opp"
          speaking={talking ? "opp" : null}
          phase={closingBusy ? `${turnLabel(opTurn)} يستعد للختام…` : "الكلمة الختامية للخصم"}
        />

        <SpeakerCard
          side={opTurn.side}
          label={`${turnLabel(opTurn)} · الكلمة الختامية`}
          speaking={talking}
          busy={closingBusy}
        >
          <div className="max-h-[40dvh] overflow-y-auto text-lg [&_p]:leading-9">
            {closingBusy ? (
              <p role="status" className="animate-pulse text-muted">
                {turnLabel(opTurn)} يستعد للختام…
              </p>
            ) : closing.trim() ? (
              speakingClosing ? (
                <SpokenText text={closing} progress={speaker.progress} reveal={speaker.reveal} />
              ) : closingTyping ? (
                <Typewriter key={closing} text={closing} onFinish={() => setClosingTyping(false)} />
              ) : (
                <p className="whitespace-pre-wrap">{closing}</p>
              )
            ) : (
              <p className="text-sm text-muted">لا توجد كلمة ختامية.</p>
            )}
          </div>
        </SpeakerCard>

        {notice && !closingBusy && <p className="text-sm text-gold">{notice}</p>}

        <div className="flex flex-wrap items-center gap-2">
          {canSpeak && closing.trim() && !closingBusy && (
            <button
              type="button"
              onClick={() =>
                speakingClosing ? speaker.stop() : speaker.speakText("closing", closing, voice.rate, false)
              }
              className={iconBtn}
            >
              {speakingClosing ? "⏹ أوقف الصوت" : "▶ استمع"}
            </button>
          )}
          <button type="button" disabled={closingBusy} onClick={backToEdit} className={iconBtn}>
            ✏️ عدّل كلمتي
          </button>
        </div>

        <button
          type="button"
          disabled={closingBusy || closingTyping || speakingClosing}
          onClick={finish}
          className={`${primaryBtn} shimmer w-full py-4 text-lg`}
        >
          اعرض التقييم الختامي ←
        </button>
      </div>
    );
  }

  const ctaLabel = !canContinue
    ? `تحدّث أو اكتب (${MIN_CHARS}+ حرفًا)`
    : isLast
      ? epilogue.length > 0
        ? "أنهِ كلمتك واسمع الختام ←"
        : "أنهِ وانتقل إلى التقييم ←"
      : "الكلمة التالية ←";

  return (
    <div className="space-y-5 pb-24">
      {interlude && (
        <div role="status" className="fixed inset-0 z-40 flex items-center justify-center bg-night/95 p-8 text-center">
          <p className="font-display text-3xl font-bold leading-snug text-flame-soft">{interlude}</p>
        </div>
      )}

      <div className="sticky top-0 z-10 -mx-4 border-b border-line bg-night/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <p className={`shrink-0 rounded-lg px-3 py-1 font-display text-lg font-bold ${style.solid}`}>
            فريق {system.sides[side].label}
          </p>
          <ol className="flex flex-1 gap-1" aria-label="تقدمك">
            {teamTurns.map((t, i) => (
              <li
                key={t.id}
                aria-current={i === step ? "step" : undefined}
                className={`flex-1 rounded-md border px-1 py-1 text-center text-xs ${
                  i === step ? `${style.solid} font-semibold` : i < step ? "border-line bg-card" : "border-line text-muted"
                }`}
              >
                {turnLabel(t)}
              </li>
            ))}
          </ol>
        </div>
        <div
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-line"
          role="progressbar"
          aria-label="تقدمك في المناظرة"
          aria-valuemin={0}
          aria-valuemax={teamTurns.length}
          aria-valuenow={step + (canContinue ? 1 : 0)}
        >
          <div
            className="h-full rounded-full bg-flame transition-all duration-700 ease-out"
            style={{ width: `${((step + (canContinue ? 1 : 0.15)) / teamTurns.length) * 100}%` }}
          />
        </div>
      </div>

      <header>
        <p className="text-xs font-semibold text-flame-soft">{topic.category}</p>
        <h1 className="font-display text-2xl font-bold leading-snug sm:text-3xl">{topic.title}</h1>
        <details className="mt-1 text-sm text-muted">
          <summary className="cursor-pointer active:text-flame-soft">عن القضية</summary>
          <p className="mt-1">{topic.brief}</p>
        </details>
      </header>

      <Arena userSide={side} active={oppActive ? "opp" : "you"} speaking={arenaSpeaking} phase={phase} />

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
        <div>
          <SpeakerCard
            side={prev.side}
            label={`${turnLabel(prev)} · الخصم`}
            speaking={(typing === step || speakingOpp) && !loading}
            busy={loading}
            badge={
              oppText.trim() && oppSource ? (
                <span className={`rounded-full px-2 py-0.5 font-semibold ${sideStyle[prev.side].badge}`}>
                  {sourceLabel[oppSource]}
                </span>
              ) : null
            }
          >
            <div ref={oppRef} className="max-h-[38dvh] overflow-y-auto text-lg [&_p]:leading-9">
              {oppBody}
            </div>
          </SpeakerCard>

          {notice && !loading && <p className="mt-3 text-sm text-gold">{notice}</p>}
          {speaker.error && <p className="mt-3 text-sm text-gold">{speaker.error}</p>}
          {canSpeak && arabicVoice === false && <p className="mt-3 text-sm text-gold">لا يوجد صوت عربي على جهازك.</p>}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {canSpeak && oppText.trim() && !loading && (
              <button
                type="button"
                onClick={() => (speakingOpp ? speaker.stop() : speaker.speakText(oppKey, oppText, voice.rate, false))}
                className={iconBtn}
              >
                {speakingOpp ? "⏹ أوقف الصوت" : "▶ استمع"}
              </button>
            )}
            <button
              type="button"
              disabled={loading}
              onClick={() => void fetchOpponent(step, true)}
              className={iconBtn}
            >
              🔄 {oppText.trim() ? "كلمة أخرى" : "حاول مرة أخرى"}
            </button>
          </div>

          {(!oppText.trim() && !loading) && (
            <textarea
              id="opp"
              aria-label="كلمة الخصم"
              placeholder="ألصق كلمة الخصم هنا"
              rows={5}
              value={oppText}
              onChange={(e) => {
                setOpponents((o) => setAt(o, step, e.target.value));
                setSources((s) => setAt<Source>(s, step, "manual"));
                setTyping(null);
              }}
              className={`${field} mt-3`}
            />
          )}
        </div>
      )}

      <section className="space-y-5">
        <h2 className="text-lg font-bold">
          دورك · {turnLabel(turn)} <span className="text-muted">({role.title})</span>
        </h2>

        {dictation.supported ? (
          (() => {
            const toggleMic = () => {
              if (dictation.listening) {
                dictation.stop();
              } else {
                speaker.stop(); // لا يلتقط الميكروفون صوت الخصم
                setEditing(false);
                dictation.start();
              }
            };
            // في وضع الكتابة يبقى الميكروفون زرًّا صغيرًا حتى لا يزاحم الحقل
            return typeMode && !dictation.listening ? (
              <button type="button" onClick={toggleMic} className={`${ghostBtn} w-full py-3 text-base`}>
                تحدّث بدل الكتابة
              </button>
            ) : (
              <MicButton listening={dictation.listening} onToggle={toggleMic} />
            );
          })()
        ) : (
          <p className="text-center text-sm text-gold">الإملاء الصوتي غير مدعوم في هذا المتصفح. جرّب Chrome.</p>
        )}
        {dictation.error && <p className="text-center text-sm text-gold">{dictation.error}</p>}

        <div
          className={`rounded-2xl border-2 bg-card p-4 transition-all duration-300 ${
            dictation.listening ? "border-con shadow-[0_0_32px_rgba(251,113,133,.28)]" : "border-line"
          }`}
        >
          {showEditor ? (
            <textarea
              id="speech"
              ref={speechRef}
              aria-label="كلمتك"
              placeholder="اكتب كلمتك هنا"
              rows={8}
              maxLength={system.maxCharsPerSpeech}
              value={text}
              onChange={(e) => {
                if (dictation.listening) dictation.stop(); // الكتابة اليدوية توقف الإملاء حتى لا يتعارضا
                setTexts((t) => setAt(t, step, e.target.value));
              }}
              className={`${field} text-lg`}
            />
          ) : (
            <div ref={captionRef} className="max-h-[36dvh] min-h-24 overflow-y-auto" aria-live="off">
              {text ? (
                <p className="whitespace-pre-wrap text-xl leading-9">
                  {text}
                  {dictation.listening && <span className="animate-pulse text-con">▍</span>}
                </p>
              ) : (
                <p className="text-lg text-muted">كلمتك ستظهر هنا أثناء حديثك…</p>
              )}
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Ring value={text.length} max={system.maxCharsPerSpeech} ok={canContinue} />
            <span className="text-sm text-muted">
              {text.length} / {system.maxCharsPerSpeech}
            </span>
            <span className="flex-1" />
            {dictation.supported && (
              <button
                type="button"
                aria-pressed={editing}
                onClick={() => {
                  if (dictation.listening) dictation.stop();
                  focusEditor.current = !editing;
                  setEditing((v) => !v);
                }}
                className={iconBtn}
              >
                {editing ? "✔ تم" : "⌨️ اكتب"}
              </button>
            )}
          </div>
        </div>
      </section>

      {/* شريط الإجراء الرئيسي ثابت أسفل الشاشة فوق التنقل */}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 px-4 pb-2 pt-8"
        style={{ background: "linear-gradient(to top, var(--color-night) 55%, transparent)" }}
      >
        <div className="pointer-events-auto mx-auto flex max-w-3xl gap-2">
          {step > 0 && (
            <button type="button" onClick={() => go(step - 1)} className={`${ghostBtn} px-4 text-lg`}>
              → السابقة
            </button>
          )}
          <button
            type="button"
            onClick={isLast ? startClosing : () => go(step + 1)}
            disabled={!canContinue}
            className={`${primaryBtn} flex-1 py-4 text-lg ${canContinue ? "shimmer" : ""}`}
          >
            {ctaLabel}
          </button>
        </div>
      </div>

    </div>
  );
}
