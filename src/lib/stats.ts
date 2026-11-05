import { buildCriteria, getTurn } from "./data";
import type { Criterion, Session } from "../types";

export const ratio = (c: Criterion, answers: Record<string, boolean>) =>
  c.questions.filter((q) => answers[q.id]).length / c.questions.length;

export function scoreSession(s: Session) {
  const ev = s.evaluation;
  const turn = getTurn(s.turnId);
  if (!ev || !turn) return null;
  const criteria = buildCriteria(turn, s.opponentText.length > 0);
  const all = criteria.flatMap((c) => c.questions);
  const overall = Math.round(
    (all.filter((q) => ev.answers[q.id]).length / all.length) * 100
  );
  const byCriterion: Record<string, number> = {};
  criteria.forEach((c) => {
    byCriterion[c.id] = Math.round(ratio(c, ev.answers) * 100);
  });
  return { overall, byCriterion };
}
