import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { buildCriteria, getTopic, getTurn, rubric, turnLabel } from "../lib/data";
import { getSession, saveSession } from "../lib/storage";
import { ratio } from "../lib/stats";
import { field, ghostBtn, primaryBtn } from "../lib/ui";
import AiPanel from "../components/AiPanel";
import type { Criterion, Evaluation as Eval, Session, Topic, Turn } from "../types";

function YesNo(props: { value: boolean | undefined; onChange: (v: boolean) => void }) {
  const base = "rounded-md border px-4 py-1.5 text-sm font-semibold";
  return (
    <div role="group" className="flex shrink-0 gap-2">
      <button
        type="button"
        aria-pressed={props.value === true}
        onClick={() => props.onChange(true)}
        className={`${base} ${props.value === true ? "border-pro bg-pro text-white" : "border-line bg-card"}`}
      >
        نعم
      </button>
      <button
        type="button"
        aria-pressed={props.value === false}
        onClick={() => props.onChange(false)}
        className={`${base} ${props.value === false ? "border-con bg-con text-white" : "border-line bg-card"}`}
      >
        لا
      </button>
    </div>
  );
}

function buildExport(session: Session, topic: Topic, turn: Turn, criteria: Criterion[]) {
  const a = session.evaluation?.answers ?? session.partnerEvaluation?.answers ?? {};
  const lines = [`الموضوع: ${topic.title}`, `الدور: ${turnLabel(turn)}`, ""];
  if (session.opponentText) lines.push("كلمة الخصم:", session.opponentText, "");
  lines.push("كلمتي:", session.text, "", "التقييم:");
  criteria.forEach((c) => lines.push(`- ${c.title}: ${Math.round(ratio(c, a) * 100)}%`));
  return lines.join("\n");
}

function Results(props: {
  criteria: Criterion[];
  session: Session;
  topic: Topic;
  turn: Turn;
  onEdit: () => void;
  onSession: (s: Session) => void;
}) {
  const { criteria, session, topic, turn } = props;
  const [copied, setCopied] = useState(false);
  const self = session.evaluation?.answers;
  const partner = session.partnerEvaluation?.answers;
  const answers = (self ?? partner) as Record<string, boolean>;
  const primary = session.evaluation ?? session.partnerEvaluation;

  const all = criteria.flatMap((c) => c.questions);
  const overall = Math.round((all.filter((q) => answers[q.id]).length / all.length) * 100);
  const weak = criteria
    .filter((c) => ratio(c, answers) < rubric.weakBelow)
    .sort((a, b) => ratio(a, answers) - ratio(b, answers));
  const ignoredStrongest = !!session.opponentText && primary?.answeredIt === false;
  const differences = self && partner ? all.filter((q) => self[q.id] !== partner[q.id]) : [];

  const exportText = buildExport(session, topic, turn, criteria);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(exportText);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([exportText], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `munazara-${session.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      <section>
        <h2 className="font-display text-3xl font-bold">
          نتيجة {self ? "تقييمك" : "تقييم الشريك"}: {overall}%
        </h2>
        {self && partner && (
          <p className="mt-2 text-sm text-muted">
            الشريط الداكن تقييمك، والذهبي تقييم الشريك.
          </p>
        )}
        <ul className="mt-4 space-y-3">
          {criteria.map((c) => {
            const pct = Math.round(ratio(c, answers) * 100);
            const partnerPct = self && partner ? Math.round(ratio(c, partner) * 100) : null;
            return (
              <li key={c.id}>
                <div className="flex justify-between text-sm">
                  <span>{c.title}</span>
                  <span>{pct}%{partnerPct !== null ? ` / ${partnerPct}%` : ""}</span>
                </div>
                <div className="mt-1 h-2 rounded bg-line">
                  <div className="h-2 rounded bg-ink" style={{ width: `${pct}%` }} />
                </div>
                {partnerPct !== null && (
                  <div className="mt-1 h-2 rounded bg-line">
                    <div className="h-2 rounded bg-gold" style={{ width: `${partnerPct}%` }} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {differences.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold">أين اختلفتما؟</h2>
          <p className="mt-1 text-sm text-muted">ناقشا هذه النقاط؛ غالبًا فيها أصدق ملاحظة.</p>
          <ul className="mt-3 space-y-2">
            {differences.map((q) => (
              <li key={q.id} className="rounded-lg border border-line bg-card p-3 text-sm">
                <p>{q.text}</p>
                <p className="mt-1 text-muted">
                  أنت: {self![q.id] ? "نعم" : "لا"} · الشريك: {partner![q.id] ? "نعم" : "لا"}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="text-lg font-semibold">ما تحسّنه الآن</h2>
        {weak.length === 0 && !ignoredStrongest ? (
          <p className="mt-2 text-muted">كل المعايير فوق الحد. جرّب موضوعًا أصعب أو دورًا آخر.</p>
        ) : (
          <ul className="mt-3 space-y-4">
            {ignoredStrongest && (
              <li className="rounded-lg border-s-4 border-con bg-card p-4">
                <p className="font-semibold">لم تردّ على أقوى نقطة عند الخصم</p>
                <p className="mt-1 text-sm text-muted">ابدأ ردّك بها قبل أي نقطة أخرى.</p>
              </li>
            )}
            {weak.map((c) => (
              <li key={c.id} className="rounded-lg border-s-4 border-con bg-card p-4">
                <p className="font-semibold">{c.title} ({Math.round(ratio(c, answers) * 100)}%)</p>
                <p className="mt-1 text-sm">{c.tip}</p>
                <ul className="mt-2 list-disc space-y-1 ps-5 text-sm text-muted">
                  {c.questions.filter((q) => answers[q.id] === false).map((q) => (
                    <li key={q.id}>{q.text}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>

      {!partner && (
        <section className="rounded-lg border border-line bg-card p-4">
          <h2 className="font-semibold">تقييم الشريك</h2>
          <p className="mt-1 text-sm text-muted">
            سلّم الجهاز لشخص آخر ليقرأ كلمتك ويملأ القائمة نفسها. تقييم غيرك أقل انحيازًا.
          </p>
          <Link to="?by=partner" className={`${ghostBtn} mt-3`}>ابدأ تقييم الشريك</Link>
        </section>
      )}

      <AiPanel
        session={session}
        topic={topic}
        turn={turn}
        criteria={criteria}
        onSession={props.onSession}
      />

      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={props.onEdit} className={ghostBtn}>عدّل الإجابات</button>
        <button type="button" onClick={copy} className={ghostBtn}>
          {copied ? "تم النسخ" : "انسخ النص"}
        </button>
        <button type="button" onClick={download} className={ghostBtn}>نزّل ملفًا</button>
        {session.teamId && (
          <Link to={`/team/${session.teamId}`} className={ghostBtn}>ملخص الفريق</Link>
        )}
        <Link to="/topics" className={primaryBtn}>تدريب جديد</Link>
      </div>
    </div>
  );
}

function EvaluationInner({ partnerMode }: { partnerMode: boolean }) {
  const { sessionId } = useParams();
  const [session, setSession] = useState<Session | undefined>(() =>
    sessionId ? getSession(sessionId) : undefined
  );
  const current = partnerMode ? session?.partnerEvaluation : session?.evaluation;
  const [answers, setAnswers] = useState<Record<string, boolean>>(current?.answers ?? {});
  const [strongest, setStrongest] = useState(current?.strongestPoint ?? "");
  const [answeredIt, setAnsweredIt] = useState<boolean | null>(current?.answeredIt ?? null);
  const [showResult, setShowResult] = useState(!!current);

  const topic = session ? getTopic(session.topicId) : undefined;
  const turn = session ? getTurn(session.turnId) : undefined;

  if (!session || !topic || !turn) {
    return (
      <p>
        الجلسة غير موجودة. <Link to="/topics" className="underline">ابدأ تدريبًا جديدًا</Link>
      </p>
    );
  }

  const hasOpponent = session.opponentText.length > 0;
  const criteria = buildCriteria(turn, hasOpponent);
  const complete =
    criteria.every((c) => c.questions.every((q) => answers[q.id] !== undefined)) &&
    (!hasOpponent || answeredIt !== null);

  const submit = () => {
    const ev: Eval = {
      answers,
      strongestPoint: strongest.trim(),
      answeredIt: hasOpponent ? answeredIt : null,
      finishedAt: new Date().toISOString(),
    };
    const updated: Session = partnerMode
      ? { ...session, partnerEvaluation: ev }
      : { ...session, evaluation: ev };
    saveSession(updated);
    setSession(updated);
    setShowResult(true);
    window.scrollTo(0, 0);
  };

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm text-muted">
          {turnLabel(turn)}
          {partnerMode ? " · تقييم الشريك" : ""}
        </p>
        <h1 className="font-display text-2xl font-bold leading-snug">{topic.title}</h1>
        {partnerMode && !showResult && (
          <p className="mt-2 rounded-lg border-s-4 border-gold bg-card p-3 text-sm">
            اقرأ كلمة صاحبها أولًا، ثم أجب. كلمة «أنا» في الأسئلة تعني صاحب الكلمة.
          </p>
        )}
      </header>

      <section className={`grid gap-4 ${hasOpponent ? "md:grid-cols-2" : ""}`}>
        {hasOpponent && (
          <div>
            <h2 className="mb-2 font-semibold">كلمة الخصم</h2>
            <p className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-line bg-card p-3 leading-8">
              {session.opponentText}
            </p>
          </div>
        )}
        <div>
          <h2 className="mb-2 font-semibold">{partnerMode ? "الكلمة المقيَّمة" : "كلمتك"}</h2>
          <p className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-line bg-card p-3 leading-8">
            {session.text}
          </p>
        </div>
      </section>

      {showResult ? (
        <Results
          criteria={criteria}
          session={session}
          topic={topic}
          turn={turn}
          onEdit={() => setShowResult(false)}
          onSession={setSession}
        />
      ) : (
        <>
          {hasOpponent && (
            <section className="space-y-3">
              <label htmlFor="strong" className="text-lg font-semibold">
                ما أقوى نقطة عند الخصم؟
              </label>
              <textarea
                id="strong"
                rows={2}
                value={strongest}
                onChange={(e) => setStrongest(e.target.value)}
                className={field}
              />
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p>{partnerMode ? "هل ردّ عليها صاحب الكلمة؟" : "هل رددتَ عليها في كلمتك؟"}</p>
                <YesNo value={answeredIt === null ? undefined : answeredIt} onChange={setAnsweredIt} />
              </div>
            </section>
          )}

          {criteria.map((c) => (
            <section key={c.id}>
              <h2 className="text-lg font-semibold">{c.title}</h2>
              <p className="text-sm text-muted">{c.hint}</p>
              <div className="mt-2">
                {c.questions.map((q) => (
                  <div
                    key={q.id}
                    className="flex flex-col gap-2 border-b border-line py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <p>{q.text}</p>
                    <YesNo
                      value={answers[q.id]}
                      onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))}
                    />
                  </div>
                ))}
              </div>
            </section>
          ))}

          <div>
            <button type="button" onClick={submit} disabled={!complete} className={primaryBtn}>
              احسب النتيجة
            </button>
            {!complete && <p className="mt-2 text-sm text-muted">أجب عن كل الأسئلة لتظهر النتيجة.</p>}
          </div>
        </>
      )}
    </div>
  );
}

export default function Evaluation() {
  const [params] = useSearchParams();
  const partnerMode = params.get("by") === "partner";
  return <EvaluationInner key={partnerMode ? "partner" : "self"} partnerMode={partnerMode} />;
}
