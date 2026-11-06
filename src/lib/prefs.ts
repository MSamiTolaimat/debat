/** تفضيلات التدريب (تُحفظ في المتصفح فقط). */
export type ReplyMode = "voice" | "type";
export type OppLength = "short" | "medium" | "long";

export interface Prefs {
  /** طريقة الرد الافتراضية: بالصوت (الميكروفون) أو بالكتابة (الحقل مفتوح) */
  replyMode: ReplyMode;
  /** طول كلمة الخصم التي يولّدها الذكاء الاصطناعي */
  oppLength: OppLength;
}

const KEY = "debate.prefs.v1";
export const DEFAULT_PREFS: Prefs = { replyMode: "voice", oppLength: "medium" };

export function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_PREFS;
    const p = JSON.parse(raw) as Partial<Prefs>;
    return {
      replyMode: p.replyMode === "type" ? "type" : "voice",
      oppLength: p.oppLength === "short" || p.oppLength === "long" ? p.oppLength : "medium",
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(p: Prefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* تجاهل */
  }
}

/** عدد الكلمات المطلوب من الخصم: [الأدنى، الأعلى] للمتحدث الافتتاحي ولغيره */
export const LENGTH_WORDS: Record<OppLength, { open: [number, number]; other: [number, number] }> = {
  short: { open: [80, 120], other: [90, 140] },
  medium: { open: [140, 200], other: [170, 260] },
  long: { open: [200, 260], other: [260, 340] },
};
