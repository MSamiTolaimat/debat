import type { DebateReview, Session, Side } from "../types";

const KEY = "debate.sessions.v2";

export function loadSessions(): Session[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Session[]) : [];
  } catch {
    return [];
  }
}

export function getSession(id: string): Session | undefined {
  return loadSessions().find((s) => s.id === id);
}

export function saveSession(session: Session) {
  const list = loadSessions();
  const i = list.findIndex((s) => s.id === session.id);
  if (i >= 0) list[i] = session;
  else list.unshift(session);
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* التخزين ممتلئ أو معطّل: تستمر الجلسة بدون حفظ */
  }
}

export function deleteSessions(ids: string[]) {
  const list = loadSessions().filter((s) => !ids.includes(s.id));
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* تجاهل */
  }
}

export const newId = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export interface Draft {
  side: Side;
  step: number;
  texts: string[];
  opponents: string[];
  /** مصدر كلمة الخصم لكل خطوة: ai أو bank أو manual أو فارغ */
  sources?: string[];
  /** رقم نسخة بنك النصوص المستعملة في هذه الجلسة */
  variant?: number;
  /** الكلمة الختامية للخصم بعد كلمة الطالب الأخيرة */
  closing?: string;
}

const DRAFT_PREFIX = "debate.draft.v2:";

export function loadDraft(topicId: string): Draft | undefined {
  try {
    const raw = localStorage.getItem(DRAFT_PREFIX + topicId);
    if (!raw) return undefined;
    const d = JSON.parse(raw) as Draft;
    const ok =
      (d.side === "pro" || d.side === "con") &&
      Array.isArray(d.texts) && d.texts.length === 3 &&
      Array.isArray(d.opponents) && d.opponents.length === 3 &&
      typeof d.step === "number" && d.step >= 0 && d.step <= 2;
    return ok ? d : undefined;
  } catch {
    return undefined;
  }
}

export function saveDraft(topicId: string, draft: Draft) {
  try {
    localStorage.setItem(DRAFT_PREFIX + topicId, JSON.stringify(draft));
  } catch {
    /* تجاهل */
  }
}

export function clearDraft(topicId: string) {
  try {
    localStorage.removeItem(DRAFT_PREFIX + topicId);
  } catch {
    /* تجاهل */
  }
}

/** مواضيع لها مسودة فيها نص مكتوب (تدريب لم يكتمل) */
export function topicsWithDraft(): string[] {
  const out: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(DRAFT_PREFIX)) continue;
      const id = k.slice(DRAFT_PREFIX.length);
      const d = loadDraft(id);
      if (d && d.texts.some((t) => t.trim().length > 0)) out.push(id);
    }
  } catch {
    /* تجاهل */
  }
  return out;
}

const REVIEW_KEY = "debate.reviews.v1";

function loadReviews(): Record<string, DebateReview> {
  try {
    const raw = localStorage.getItem(REVIEW_KEY);
    return raw ? (JSON.parse(raw) as Record<string, DebateReview>) : {};
  } catch {
    return {};
  }
}

export const loadReview = (teamId: string): DebateReview | undefined => loadReviews()[teamId];

export function saveReview(teamId: string, review: DebateReview) {
  const all = loadReviews();
  all[teamId] = review;
  try {
    localStorage.setItem(REVIEW_KEY, JSON.stringify(all));
  } catch {
    /* تجاهل */
  }
}
