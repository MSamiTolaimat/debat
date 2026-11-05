import { useState } from "react";
import { Link } from "react-router-dom";
import { getTopic, getTurn, rubric, system, turnLabel } from "../lib/data";
import { deleteSessions, loadSessions } from "../lib/storage";
import { scoreSession } from "../lib/stats";
import { ghostBtn, primaryBtn } from "../lib/ui";
import type { Session } from "../types";

const rows = [
  ...rubric.criteria.map((c) => ({ id: c.id, title: c.title })),
  { id: "role", title: rubric.roleCriterion.title },
];

function Trend({ points }: { points: number[] }) {
  const W = 300;
  const H = 110;
  const xs = points.map((_, i) => 12 + (i * (W - 24)) / (points.length - 1));
  const ys = points.map((p) => H - 10 - (p / 100) * (H - 20));
  const line = xs.map((x, i) => `${x},${ys[i]}`).join(" ");
  return (
    <div dir="ltr">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`تطور النتيجة العامة من ${points[0]}% إلى ${points[points.length - 1]}%`}
        className="w-full rounded-lg border border-line bg-card"
      >
        <polyline points={line} fill="none" stroke="var(--color-ink)" strokeWidth="2" />
        {xs.map((x, i) => (
          <circle key={i} cx={x} cy={ys[i]} r="3.5" fill="var(--color-pro)" />
        ))}
      </svg>
    </div>
  );
}

interface Entry {
  key: string;
  link: string;
  title: string;
  sub: string;
  overall: number | null;
  ids: string[];
  linkLabel: string;
}

export default function History() {
  const [sessions, setSessions] = useState(loadSessions);

  const remove = (ids: string[]) => {
    if (!window.confirm("حذف هذا التدريب نهائيًا؟")) return;
    deleteSessions(ids);
    setSessions(loadSessions());
  };

  if (sessions.length === 0) {
    return (
      <div>
        <h1 className="font-display text-3xl font-bold">السجل</h1>
        <p className="mt-3 text-muted">لا توجد تدريبات بعد. أنهِ تدريبًا واحدًا ليظهر هنا.</p>
        <Link to="/topics" className={`${primaryBtn} mt-5`}>ابدأ تدريبًا</Link>
      </div>
    );
  }

  const groups = new Map<string, Session[]>();
  sessions.forEach((s) => {
    const k = s.teamId ?? s.id;
    groups.set(k, [...(groups.get(k) ?? []), s]);
  });

  const entries: Entry[] = Array.from(groups.entries()).map(([key, list]) => {
    const scored = list.map((s) => scoreSession(s)).filter((x): x is NonNullable<typeof x> => x !== null);
    const overall = scored.length
      ? Math.round(scored.reduce((a, s) => a + s.overall, 0) / scored.length)
      : null;
    const first = list[0];
    const topic = getTopic(first.topicId);
    const turn = getTurn(first.turnId);
    const date = new Date(first.createdAt).toLocaleDateString("ar");
    const result = overall !== null ? `${overall}%` : "لم يُقيَّم بعد";
    const isTeam = !!first.teamId;
    return {
      key,
      link: isTeam ? `/team/${key}` : `/evaluate/${first.id}`,
      title: topic?.title ?? "موضوع محذوف",
      sub: isTeam
        ? `فريق ${turn ? system.sides[turn.side].label : ""} · ${date} · ${result} · ${scored.length} من ${list.length} كلمات مقيَّمة`
        : `${turn ? turnLabel(turn) : ""} · ${date} · ${result}`,
      overall,
      ids: list.map((s) => s.id),
      linkLabel: isTeam ? "افتح ملخص الفريق" : overall !== null ? "افتح النتيجة" : "أكمل التقييم",
    };
  });

  const trend = [...entries].reverse().filter((e) => e.overall !== null).map((e) => e.overall as number);

  const scoredSpeeches = sessions
    .map((s) => scoreSession(s))
    .filter((x): x is NonNullable<typeof x> => x !== null);
  const averages = rows
    .map((r) => {
      const vals = scoredSpeeches.map((s) => s.byCriterion[r.id]).filter((v) => v !== undefined);
      return { ...r, avg: vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null };
    })
    .filter((r): r is typeof r & { avg: number } => r.avg !== null);
  const weakest = averages.length ? [...averages].sort((a, b) => a.avg - b.avg)[0] : null;

  return (
    <div className="space-y-8">
      <h1 className="font-display text-3xl font-bold">السجل</h1>

      {trend.length >= 2 ? (
        <section>
          <h2 className="mb-2 text-lg font-semibold">تطور النتيجة العامة</h2>
          <Trend points={trend} />
        </section>
      ) : (
        <p className="text-muted">قيّم تدريبين على الأقل ليظهر منحنى التقدم.</p>
      )}

      {averages.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold">متوسطك في كل معيار</h2>
          {weakest && trend.length >= 2 && (
            <p className="mt-1 text-sm text-muted">أضعف معيار عندك الآن: {weakest.title}.</p>
          )}
          <ul className="mt-3 space-y-3">
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

      <section>
        <h2 className="text-lg font-semibold">التدريبات</h2>
        <ul className="mt-3 space-y-3">
          {entries.map((e) => (
            <li key={e.key} className="rounded-lg border border-line bg-card p-4">
              <p className="font-display text-lg font-bold">{e.title}</p>
              <p className="mt-1 text-sm text-muted">{e.sub}</p>
              <div className="mt-3 flex gap-2">
                <Link to={e.link} className={ghostBtn}>{e.linkLabel}</Link>
                <button type="button" onClick={() => remove(e.ids)} className={ghostBtn}>حذف</button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
