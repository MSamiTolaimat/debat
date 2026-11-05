import { Link, useParams } from "react-router-dom";
import { getTopic, getTurn, rubric, sideStyle, system, turnLabel } from "../lib/data";
import { loadSessions } from "../lib/storage";
import { scoreSession } from "../lib/stats";
import { ghostBtn, primaryBtn } from "../lib/ui";

const rows = [
  ...rubric.criteria.map((c) => ({ id: c.id, title: c.title })),
  { id: "role", title: rubric.roleCriterion.title },
];

export default function Team() {
  const { teamId } = useParams();
  const sessions = loadSessions()
    .filter((s) => s.teamId === teamId)
    .sort((a, b) => (getTurn(a.turnId)?.speaker ?? 0) - (getTurn(b.turnId)?.speaker ?? 0));

  const first = sessions[0];
  const topic = first ? getTopic(first.topicId) : undefined;
  const side = first ? getTurn(first.turnId)?.side : undefined;

  if (!first || !topic || !side) {
    return (
      <p>
        الفريق غير موجود. <Link to="/topics" className="underline">ابدأ تدريبًا جديدًا</Link>
      </p>
    );
  }

  const scores = sessions.map((s) => scoreSession(s));
  const evaluated = scores.filter((x): x is NonNullable<typeof x> => x !== null);
  const overall = evaluated.length
    ? Math.round(evaluated.reduce((a, s) => a + s.overall, 0) / evaluated.length)
    : null;
  const nextIndex = scores.findIndex((s) => s === null);

  const averages = rows
    .map((r) => {
      const vals = evaluated.map((s) => s.byCriterion[r.id]).filter((v) => v !== undefined);
      return { ...r, avg: vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null };
    })
    .filter((r): r is typeof r & { avg: number } => r.avg !== null);
  const weakest = averages.length ? [...averages].sort((a, b) => a.avg - b.avg)[0] : null;

  return (
    <div className="space-y-8">
      <header>
        <p className={`text-sm font-semibold ${sideStyle[side].text}`}>
          فريق {system.sides[side].label}
        </p>
        <h1 className="font-display text-3xl font-bold leading-snug">{topic.title}</h1>
      </header>

      <section>
        <h2 className="text-lg font-semibold">كلمات الفريق</h2>
        <ul className="mt-3 space-y-3">
          {sessions.map((s, i) => {
            const turn = getTurn(s.turnId)!;
            const score = scores[i];
            return (
              <li key={s.id} className={`rounded-lg border-s-4 bg-card p-4 ${sideStyle[side].border}`}>
                <p className="font-semibold">
                  {turnLabel(turn)}: {system.roles[String(turn.speaker)].title}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {score ? `النتيجة ${score.overall}%` : "لم تُقيَّم بعد"}
                </p>
                <Link to={`/evaluate/${s.id}`} className={`${ghostBtn} mt-3`}>
                  {score ? "افتح النتيجة" : "قيّم هذه الكلمة"}
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {overall !== null && (
        <section>
          <h2 className="font-display text-3xl font-bold">نتيجة الفريق: {overall}%</h2>
          {evaluated.length < sessions.length && (
            <p className="mt-1 text-sm text-muted">
              محسوبة من {evaluated.length} من {sessions.length} كلمات. قيّم الباقي لتكتمل.
            </p>
          )}
          {weakest && evaluated.length === sessions.length && (
            <p className="mt-2 text-muted">أضعف معيار في كلمات فريقك: {weakest.title}.</p>
          )}
          <ul className="mt-4 space-y-3">
            {averages.map((r) => (
              <li key={r.id}>
                <div className="flex justify-between text-sm">
                  <span>{r.title}</span>
                  <span>{r.avg}%</span>
                </div>
                <div className="mt-1 h-2 rounded bg-line">
                  <div className="h-2 rounded bg-ink" style={{ width: `${r.avg}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-wrap gap-3">
        {nextIndex >= 0 && (
          <Link to={`/evaluate/${sessions[nextIndex].id}`} className={primaryBtn}>
            قيّم {turnLabel(getTurn(sessions[nextIndex].turnId)!)}
          </Link>
        )}
        <Link to="/topics" className={nextIndex >= 0 ? ghostBtn : primaryBtn}>تدريب جديد</Link>
      </div>
    </div>
  );
}
