import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { getTurn, system, turnLabel } from "../lib/data";
import { loadAiSettings, reviewDebate } from "../lib/gemini";
import { buildTranscript } from "../lib/reviewPrompt";
import { loadReview, saveReview } from "../lib/storage";
import { ghostBtn, primaryBtn } from "../lib/ui";
import type { DebateReview as Review, Session, Side, Topic } from "../types";

const STEPS = [
  "يقرأ المناظرة كاملة…",
  "يطابق كلماتك مع حجج الخصم…",
  "يبحث عمّا كان يجب أن تقوله…",
  "يصوغ لك البدائل…",
];

function Unverified() {
  return <span className="ms-2 text-xs text-gold">(اقتباس تقريبي)</span>;
}

/** تقييم الذكاء الاصطناعي للمناظرة كلها في نهايتها: نقاط الضعف، وماذا كان يجب أن يُقال. */
export default function DebateReview(props: {
  teamId: string;
  sessions: Session[];
  topic: Topic;
  side: Side;
  autoRun: boolean;
}) {
  const { teamId, sessions, topic, side } = props;
  const [settings] = useState(loadAiSettings);
  const [review, setReview] = useState<Review | undefined>(() => loadReview(teamId));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState(0);
  const started = useRef(false);
  const ready = !!settings?.key;

  const run = async () => {
    if (!settings) return;
    setBusy(true);
    setError("");
    setMsg(0);
    try {
      const r = await reviewDebate(settings, { topic, side, transcript: buildTranscript(sessions, side) });
      saveReview(teamId, r);
      setReview(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "حدث خطأ غير متوقع.");
    } finally {
      setBusy(false);
    }
  };

  // عند الوصول مباشرة من نهاية التحدي نبدأ التقييم تلقائيًا (مرة واحدة)
  useEffect(() => {
    if (props.autoRun && ready && !review && !started.current) {
      started.current = true;
      void run();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!busy) return;
    const id = setInterval(() => setMsg((m) => (m + 1) % STEPS.length), 2600);
    return () => clearInterval(id);
  }, [busy]);

  return (
    <section className="space-y-5 rounded-2xl border border-flame/40 bg-card p-4">
      <div>
        <h2 className="font-display text-2xl font-bold text-flame-soft">التقييم الختامي بالذكاء الاصطناعي</h2>
        <p className="mt-1 text-xs text-muted">قد يخطئ النموذج، فاعتبره رأي مدرب مساعد.</p>
      </div>

      {!ready ? (
        <p className="text-sm">
          أضف مفتاح Gemini من <Link to="/settings" className="underline">الإعدادات</Link> لتفعيله.
        </p>
      ) : (
        !busy && (
          <button type="button" onClick={run} className={review ? ghostBtn : primaryBtn}>
            {review ? "أعد التقييم" : "قيّم مناظرتي"}
          </button>
        )
      )}

      {busy && (
        <div role="status" className="space-y-3">
          <p key={msg} className="fade-up font-semibold">{STEPS[msg]}</p>
          <div className="h-2 overflow-hidden rounded bg-line">
            <div className="indeterminate h-2 w-1/3 rounded bg-flame" />
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-lg border-s-4 border-con bg-paper p-3 text-sm">
          {error}
        </p>
      )}

      {review && !busy && (
        <div className="space-y-6">
          {review.summary && <p className="rounded-lg bg-paper p-3 leading-8">{review.summary}</p>}

          {review.priorities.length > 0 && (
            <div>
              <h3 className="font-semibold">ما تتدرب عليه أولًا</h3>
              <ol className="mt-2 list-decimal space-y-1 ps-6 text-sm leading-7">
                {review.priorities.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ol>
            </div>
          )}

          <div className="space-y-3">
            <h3 className="font-semibold">كلمة بكلمة</h3>
            {review.speeches.map((sp, i) => {
              const turn = getTurn(sp.turnId);
              if (!turn) return null;
              return (
                <details
                  key={sp.turnId}
                  open={i === 0}
                  style={{ animationDelay: `${i * 90}ms` }}
                  className="fade-up rounded-xl border border-line bg-paper p-3 transition-colors hover:border-flame/50 open:border-flame/40"
                >
                  <summary className="cursor-pointer font-semibold active:text-flame-soft">
                    {turnLabel(turn)} · {system.roles[String(turn.speaker)].title}
                  </summary>
                  <div className="mt-3 space-y-4">
                    {sp.weaknesses.length === 0 && <p className="text-sm text-muted">لم يجد النموذج نقاط ضعف بارزة.</p>}
                    {sp.weaknesses.map((w, j) => (
                      <div key={j} className="space-y-2 text-sm leading-7">
                        {w.quote && (
                          <p className="text-muted">
                            «{w.quote}»{!w.verified && <Unverified />}
                          </p>
                        )}
                        <p className="border-s-4 border-con ps-3 font-semibold">{w.problem}</p>
                        {w.shouldSay && (
                          <div className="rounded-lg border border-pro/50 bg-pro-soft p-3">
                            <p className="text-xs font-bold text-pro">ماذا كان يجب أن تقول</p>
                            <p className="mt-1">{w.shouldSay}</p>
                          </div>
                        )}
                      </div>
                    ))}
                    {sp.strength.why && (
                      <div className="border-s-4 border-gold ps-3 text-sm leading-7">
                        <p className="text-xs font-bold text-gold">نقطة قوة</p>
                        {sp.strength.quote && (
                          <p className="text-muted">
                            «{sp.strength.quote}»{!sp.strength.verified && <Unverified />}
                          </p>
                        )}
                        <p>{sp.strength.why}</p>
                      </div>
                    )}
                  </div>
                </details>
              );
            })}
          </div>

          {review.missed.length > 0 && (
            <div>
              <h3 className="font-semibold">حجج للخصم لم تردّ عليها</h3>
              <ul className="mt-2 space-y-3">
                {review.missed.map((m, i) => (
                  <li key={i} className="space-y-2 rounded-xl border border-line bg-paper p-3 text-sm leading-7">
                    {m.opponentQuote && (
                      <p className="text-muted">
                        قال الخصم: «{m.opponentQuote}»{!m.verified && <Unverified />}
                      </p>
                    )}
                    <div className="rounded-lg border border-pro/50 bg-pro-soft p-3">
                      <p className="text-xs font-bold text-pro">كان يمكنك أن تردّ</p>
                      <p className="mt-1">{m.shouldSay}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-xs text-muted">
            النموذج: {review.model} · {new Date(review.createdAt).toLocaleString("ar")}
          </p>
        </div>
      )}
    </section>
  );
}
