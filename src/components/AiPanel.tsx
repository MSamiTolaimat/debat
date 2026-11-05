import { useState } from "react";
import { Link } from "react-router-dom";
import { evaluateWithGemini, loadAiSettings } from "../lib/gemini";
import { saveSession } from "../lib/storage";
import { ratio } from "../lib/stats";
import { ghostBtn, primaryBtn } from "../lib/ui";
import type { Criterion, Session, Topic, Turn } from "../types";

export default function AiPanel(props: {
  session: Session;
  topic: Topic;
  turn: Turn;
  criteria: Criterion[];
  onSession: (s: Session) => void;
}) {
  const { session, topic, turn, criteria } = props;
  const [settings] = useState(loadAiSettings);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ai = session.aiEvaluation;
  const ready = !!settings?.key && settings.consent;
  const self = session.evaluation?.answers;

  const run = async () => {
    if (!settings) return;
    setBusy(true);
    setError("");
    try {
      const result = await evaluateWithGemini(settings, {
        topic,
        turn,
        criteria,
        text: session.text,
        opponentText: session.opponentText,
      });
      const updated: Session = { ...session, aiEvaluation: result };
      saveSession(updated);
      props.onSession(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "حدث خطأ غير متوقع.");
    } finally {
      setBusy(false);
    }
  };

  const all = criteria.flatMap((c) => c.questions);
  const differences = ai && self ? all.filter((q) => self[q.id] !== ai.answers[q.id]) : [];

  return (
    <section className="space-y-5 rounded-lg border border-line bg-card p-4">
      <div>
        <h2 className="text-lg font-semibold">تقييم الذكاء الاصطناعي</h2>
        <p className="mt-1 text-sm text-muted">
          اختياري. يجيب النموذج عن القائمة نفسها ويقتبس دليله من نصك. قد يخطئ، فاعدّه رأيًا ثالثًا لا حكمًا.
        </p>
      </div>

      {!ready ? (
        <p className="text-sm">
          لتفعيله أضف مفتاح Gemini المجاني ووافق على الشروط من{" "}
          <Link to="/settings" className="underline">صفحة الإعدادات</Link>.
        </p>
      ) : (
        <button type="button" onClick={run} disabled={busy} className={ai ? ghostBtn : primaryBtn}>
          {busy ? "جارٍ التقييم…" : ai ? "أعد التقييم" : "قيّم بالذكاء الاصطناعي"}
        </button>
      )}

      {error && (
        <p role="alert" className="rounded-lg border-s-4 border-con bg-paper p-3 text-sm">
          {error}
        </p>
      )}

      {ai && (
        <div className="space-y-6">
          <p className="text-xs text-muted">
            النموذج: {ai.model} · {new Date(ai.createdAt).toLocaleString("ar")}
          </p>

          <ul className="space-y-3">
            {criteria.map((c) => {
              const pct = Math.round(ratio(c, ai.answers) * 100);
              return (
                <li key={c.id}>
                  <div className="flex justify-between text-sm">
                    <span>{c.title}</span>
                    <span>{pct}%</span>
                  </div>
                  <div className="mt-1 h-2 rounded bg-line">
                    <div className="h-2 rounded bg-pro" style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>

          {ai.weaknesses.length > 0 && (
            <div>
              <h3 className="font-semibold">أكبر نقاط الضعف</h3>
              <ul className="mt-2 space-y-3">
                {ai.weaknesses.map((w, i) => (
                  <li key={i} className="rounded-lg border-s-4 border-con bg-paper p-3 text-sm">
                    {w.quote && <p className="text-muted">«{w.quote}»</p>}
                    <p className="mt-1 font-semibold">{w.problem}</p>
                    {w.fix && <p className="mt-1">{w.fix}</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {ai.strength.why && (
            <div>
              <h3 className="font-semibold">نقطة قوة</h3>
              <div className="mt-2 rounded-lg border-s-4 border-pro bg-paper p-3 text-sm">
                {ai.strength.quote && <p className="text-muted">«{ai.strength.quote}»</p>}
                <p className="mt-1">{ai.strength.why}</p>
              </div>
            </div>
          )}

          {differences.length > 0 && (
            <div>
              <h3 className="font-semibold">أين اختلف عنك؟</h3>
              <ul className="mt-2 space-y-2">
                {differences.map((q) => (
                  <li key={q.id} className="rounded-lg border border-line p-3 text-sm">
                    <p>{q.text}</p>
                    <p className="mt-1 text-muted">
                      أنت: {self![q.id] ? "نعم" : "لا"} · الذكاء الاصطناعي: {ai.answers[q.id] ? "نعم" : "لا"}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <details>
            <summary className="cursor-pointer font-semibold">أدلة النموذج على كل إجابة</summary>
            <ul className="mt-3 space-y-2">
              {all.map((q) => {
                const ev = ai.evidence[q.id];
                return (
                  <li key={q.id} className="text-sm">
                    <p>
                      {q.text} <strong>{ai.answers[q.id] ? "نعم" : "لا"}</strong>
                    </p>
                    {ev?.text && <p className="text-muted">«{ev.text}»</p>}
                    {ev?.flag && <p className="text-gold">تنبيه: {ev.flag}</p>}
                  </li>
                );
              })}
            </ul>
          </details>
        </div>
      )}
    </section>
  );
}
