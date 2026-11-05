import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { fixedSide, sideStyle, system, topics } from "../lib/data";
import { ghostBtn } from "../lib/ui";

const levels = ["الكل", "سهل", "متوسط", "صعب"];
const categories = ["الكل", ...Array.from(new Set(topics.map((t) => t.category)))];

function Chip(props: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={props.active}
      onClick={props.onClick}
      className={`rounded-full border px-3 py-1 text-sm ${
        props.active ? "border-ink bg-ink text-white" : "border-line bg-card"
      }`}
    >
      {props.label}
    </button>
  );
}

export default function Topics() {
  const nav = useNavigate();
  const [category, setCategory] = useState("الكل");
  const [level, setLevel] = useState("الكل");

  const filtered = topics.filter(
    (t) =>
      (category === "الكل" || t.category === category) &&
      (level === "الكل" || t.difficulty === level)
  );

  const pickRandom = () => {
    if (filtered.length === 0) return;
    nav(`/session/${filtered[Math.floor(Math.random() * filtered.length)].id}`);
  };

  return (
    <div>
      <h1 className="font-display text-3xl font-bold">اختر موضوعًا</h1>

      <div className="mt-4 space-y-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="الفئة">
          {categories.map((c) => (
            <Chip key={c} label={c} active={c === category} onClick={() => setCategory(c)} />
          ))}
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="الصعوبة">
          {levels.map((l) => (
            <Chip key={l} label={l} active={l === level} onClick={() => setLevel(l)} />
          ))}
        </div>
        <button type="button" onClick={pickRandom} className={ghostBtn} disabled={filtered.length === 0}>
          موضوع عشوائي
        </button>
      </div>

      {filtered.length === 0 ? (
        <p className="mt-8 text-muted">لا توجد مواضيع بهذا التصفية. غيّر الفئة أو الصعوبة.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {filtered.map((t) => {
            const side = fixedSide(t);
            return (
            <li key={t.id}>
              <Link to={`/session/${t.id}`} className="block rounded-lg border border-line bg-card p-4 hover:border-ink">
                <p className="font-display text-xl font-bold">{t.title}</p>
                <p className="mt-1 text-sm text-muted">{t.brief}</p>
                <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                  <span>
                    {t.category} · {t.difficulty}
                  </span>
                  {side && (
                    <span className={`rounded-full px-2 py-0.5 font-semibold ${sideStyle[side].badge}`}>
                      موقفك: {system.sides[side].label}
                    </span>
                  )}
                </p>
              </Link>
            </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
