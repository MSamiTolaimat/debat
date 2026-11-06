import { useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import Confetti from "../components/Confetti";
import DebateReview from "../components/DebateReview";
import { getTopic, getTurn, sideStyle, system, turnLabel } from "../lib/data";
import { buildTranscript } from "../lib/reviewPrompt";
import { loadSessions } from "../lib/storage";
import { ghostBtn, primaryBtn } from "../lib/ui";

export default function Team() {
  const { teamId } = useParams();
  const fresh = !!(useLocation().state as { fresh?: boolean } | null)?.fresh;
  const [party, setParty] = useState(fresh);
  // التدريبات القديمة بلا teamId تُفتح بمعرّف جلستها
  const sessions = loadSessions()
    .filter((s) => (s.teamId ?? s.id) === teamId)
    .sort((a, b) => (getTurn(a.turnId)?.speaker ?? 0) - (getTurn(b.turnId)?.speaker ?? 0));

  const first = sessions[0];
  const topic = first ? getTopic(first.topicId) : undefined;
  const side = first ? getTurn(first.turnId)?.side : undefined;

  if (!first || !topic || !side) {
    return (
      <p>
        الفريق غير موجود. <Link to="/new" className="underline">ابدأ تدريبًا جديدًا</Link>
      </p>
    );
  }

  const transcript = buildTranscript(sessions, side);

  return (
    <div className="space-y-8">
      {party && <Confetti onDone={() => setParty(false)} />}
      <header>
        <p className={`text-sm font-semibold ${sideStyle[side].text}`}>فريق {system.sides[side].label}</p>
        <h1 className="font-display text-3xl font-bold leading-snug">{topic.title}</h1>
      </header>

      {fresh && (
        <div className="fade-up rounded-2xl border border-flame/50 bg-card p-4 text-center">
          <p className="pop text-4xl" aria-hidden="true">
            🏆
          </p>
          <p className="mt-1 font-display text-2xl font-bold text-flame-soft">أنهيتَ مناظرة كاملة!</p>
        </div>
      )}

      <DebateReview teamId={teamId!} sessions={sessions} topic={topic} side={side} autoRun={fresh} />

      <section>
        <h2 className="text-lg font-semibold">المناظرة كاملة</h2>
        <ul className="mt-3 space-y-2">
          {transcript.map((e) => (
            <li key={e.turn.id}>
              <details className={`rounded-lg border-s-4 bg-card p-3 ${sideStyle[e.turn.side].border}`}>
                <summary className="cursor-pointer font-semibold">
                  {turnLabel(e.turn)} · {e.mine ? "كلمتك" : "الخصم"}
                </summary>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-8">{e.text}</p>
              </details>
            </li>
          ))}
        </ul>
      </section>

      <div className="flex flex-wrap gap-3">
        <Link to="/new" className={primaryBtn}>تدريب جديد</Link>
        <Link to="/history" className={ghostBtn}>السجل</Link>
      </div>
    </div>
  );
}
