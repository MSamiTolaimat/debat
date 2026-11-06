import { useState } from "react";
import { Link } from "react-router-dom";
import { getTopic, getTurn, sideStyle, system } from "../lib/data";
import { deleteSessions, loadReview, loadSessions } from "../lib/storage";
import { ghostBtn, primaryBtn } from "../lib/ui";
import type { Session } from "../types";

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
        <Link to="/new" className={`${primaryBtn} mt-5`}>ابدأ تدريبًا</Link>
      </div>
    );
  }

  const groups = new Map<string, Session[]>();
  sessions.forEach((s) => {
    const k = s.teamId ?? s.id;
    groups.set(k, [...(groups.get(k) ?? []), s]);
  });

  const entries = Array.from(groups.entries()).map(([key, list]) => {
    const first = list[0];
    const turn = getTurn(first.turnId);
    return {
      key,
      border: turn ? sideStyle[turn.side].border : "border-line",
      title: getTopic(first.topicId)?.title ?? "موضوع محذوف",
      sub: `فريق ${turn ? system.sides[turn.side].label : ""} · ${new Date(first.createdAt).toLocaleDateString("ar")}`,
      reviewed: !!loadReview(key),
      ids: list.map((s) => s.id),
    };
  });

  return (
    <div className="space-y-8">
      <h1 className="font-display text-3xl font-bold">السجل</h1>
      <ul className="space-y-3">
        {entries.map((e, i) => (
          <li
            key={e.key}
            style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}
            className={`fade-up rounded-lg border border-line border-s-4 bg-card p-4 transition-colors hover:border-flame/50 ${e.border}`}
          >
            <p className="font-display text-lg font-bold">{e.title}</p>
            <p className="mt-1 text-sm text-muted">
              {e.sub} · {e.reviewed ? "قُيّم بالذكاء الاصطناعي" : "لم يُقيَّم بعد"}
            </p>
            <div className="mt-3 flex gap-2">
              <Link to={`/team/${e.key}`} className={ghostBtn}>
                {e.reviewed ? "افتح المناظرة والتقييم" : "افتح المناظرة"}
              </Link>
              <button type="button" onClick={() => remove(e.ids)} className={ghostBtn}>حذف</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
