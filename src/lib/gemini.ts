import { SYSTEM_INSTRUCTION, buildUserPrompt } from "./evaluatorPrompt";
import { REVIEW_SYSTEM, buildReviewPrompt } from "./reviewPrompt";
import type { Entry } from "./reviewPrompt";
import type {
  DebateReview,
  Side,
  AiEvaluation,
  AiWeakness,
  Criterion,
  Topic,
  Turn,
} from "../types";

export interface AiSettings {
  key: string;
  model: string;
  consent: boolean;
}

// النموذج الافتراضي: Gemini 3.5 Flash-Lite (النموذج 3.8 كان مشغولًا دائمًا).
// TODO: تحقق من أن له مستوى مجانيًا في لوحة حسابك، ويمكن تغييره من صفحة الإعدادات.
export const DEFAULT_MODEL = "gemini-3.5-flash-lite";
/** الافتراضي القديم: من حفظه دون تغيير ننقله تلقائيًا إلى الافتراضي الجديد */
const OLD_DEFAULT_MODEL = "gemini-3.8-flash";

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const SETTINGS_KEY = "debate.gemini.v1";

export function loadAiSettings(): AiSettings | undefined {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return undefined;
    const s = JSON.parse(raw) as AiSettings;
    return s.model === OLD_DEFAULT_MODEL ? { ...s, model: DEFAULT_MODEL } : s;
  } catch {
    return undefined;
  }
}

export function saveAiSettings(s: AiSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* تجاهل */
  }
}

export function clearAiSettings() {
  try {
    localStorage.removeItem(SETTINGS_KEY);
  } catch {
    /* تجاهل */
  }
}

interface Part {
  text?: string;
  thought?: boolean;
}

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// نماذج بديلة تُجرَّب تلقائيًا إذا ازدحم النموذج الأساسي أو بلغ حده.
// TODO: تحقق من أن لها مستوى مجانيًا في حسابك (المصدر مقالات ثانوية).
const FALLBACK_MODELS = ["gemini-3.1-flash-lite", "gemini-3.8-flash"];

const NETWORK = -1;
const TIMEOUT = 0;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function explain(res: Response): Promise<string> {
  let detail = "";
  try {
    const body = await res.json();
    detail = String(body?.error?.message ?? "");
  } catch {
    /* لا نص */
  }
  if (res.status === 429) {
    return "تجاوزتَ حد المستوى المجاني. انتظر دقيقة وأعد المحاولة، فإن تكرر فالحصة اليومية انتهت وتتجدد عند منتصف الليل بتوقيت المحيط الهادئ.";
  }
  if (
    res.status === 503 ||
    res.status === 500 ||
    res.status === 502 ||
    res.status === 504
  ) {
    return "الخدمة مزدحمة حاليًا عند Google، وهي مشكلة مؤقتة من جانبهم وليست في مفتاحك. أعد المحاولة بعد دقائق.";
  }
  if (res.status === 404) {
    return "اسم النموذج غير صحيح أو غير متاح لحسابك. غيّره من صفحة الإعدادات.";
  }
  if (res.status === 400 || res.status === 403) {
    if (/api key|permission|PERMISSION_DENIED|API_KEY/i.test(detail)) {
      return "المفتاح غير صالح أو لا يملك صلاحية. تأكد من نسخه كاملًا من AI Studio.";
    }
    return `رفض الخادم الطلب (${res.status}). ${detail}`.trim();
  }
  return `خطأ من الخادم (${res.status}). ${detail}`.trim();
}

async function requestOnce(
  model: string,
  key: string,
  body: Record<string, unknown>,
  timeoutMs: number,
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(`${BASE}/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    if (controller.signal.aborted) {
      throw new ApiError(
        TIMEOUT,
        "انتهت مهلة الخادم. الخدمة بطيئة حاليًا، أعد المحاولة بعد قليل.",
      );
    }
    throw new ApiError(
      NETWORK,
      "تعذر الاتصال بـ Google. تحقق من الإنترنت، وإن استمر فقد يمنع المتصفح الطلب (CORS).",
    );
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new ApiError(res.status, await explain(res));

  const data = await res.json();
  const parts: Part[] = data?.candidates?.[0]?.content?.parts ?? [];
  const text = parts
    .filter((p) => !p.thought)
    .map((p) => p.text ?? "")
    .join("");
  if (!text)
    throw new ApiError(
      200,
      "لم يرجع النموذج ردًا (ربما حُجب المحتوى). أعد المحاولة.",
    );
  return text;
}

// يعيد المحاولة مرة عند خطأ مؤقت، ثم ينتقل إلى نموذج بديل عند الازدحام أو الحد أو المهلة.
async function callGemini(
  settings: AiSettings,
  userText: string,
  withSystem: boolean,
  json: boolean,
  systemInstruction = SYSTEM_INSTRUCTION,
  temperature = 0.2,
  timeoutMs = 45000,
): Promise<{ text: string; model: string }> {
  const body: Record<string, unknown> = {
    contents: [{ role: "user", parts: [{ text: userText }] }],
    generationConfig: {
      temperature,
      maxOutputTokens: 8192,
      ...(json ? { responseMimeType: "application/json" } : {}),
    },
  };
  if (withSystem)
    body.system_instruction = { parts: [{ text: systemInstruction }] };

  const models = [
    settings.model,
    ...FALLBACK_MODELS.filter((m) => m !== settings.model),
  ];
  const moveOn = [TIMEOUT, 404, 429, 500, 502, 503, 504];
  let lastError: unknown;

  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const text = await requestOnce(model, settings.key, body, timeoutMs);
        return { text, model };
      } catch (e) {
        lastError = e;
        if (!(e instanceof ApiError)) throw e;
        if (e.status === NETWORK) throw e;
        const transient = [500, 502, 503, 504].includes(e.status);
        if (transient && attempt === 0) {
          await sleep(3000);
          continue;
        }
        break;
      }
    }
    if (!(lastError instanceof ApiError) || !moveOn.includes(lastError.status))
      throw lastError;
  }
  throw lastError;
}

export async function generateText(
  settings: AiSettings,
  systemInstruction: string,
  userText: string,
  temperature = 0.2,
): Promise<string> {
  const { text } = await callGemini(
    settings,
    userText,
    true,
    false,
    systemInstruction,
    temperature,
  );
  return text;
}

export async function testKey(settings: AiSettings): Promise<string> {
  const { model } = await callGemini(
    settings,
    "Reply with the single word: ready",
    false,
    false,
  );
  return model;
}

const normalize = (s: string) =>
  s
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[إأآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\u0600-\u06FFa-zA-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const found = (text: string, quote: string) =>
  quote.trim().length > 0 && normalize(text).includes(normalize(quote));

function parseJson(raw: string): unknown {
  const stripped = raw.replace(/```json|```/g, "").trim();
  const a = stripped.indexOf("{");
  const b = stripped.lastIndexOf("}");
  if (a < 0 || b < a) throw new Error("bad");
  return JSON.parse(stripped.slice(a, b + 1));
}

export async function evaluateWithGemini(
  settings: AiSettings,
  input: {
    topic: Topic;
    turn: Turn;
    criteria: Criterion[];
    text: string;
    opponentText: string;
  },
): Promise<AiEvaluation> {
  const { text: raw, model } = await callGemini(
    settings,
    buildUserPrompt(input),
    true,
    true,
  );

  let data: any;
  try {
    data = parseJson(raw);
  } catch {
    throw new Error("جاء رد النموذج بصيغة غير صالحة. أعد المحاولة.");
  }

  const returned: Record<string, { answer: boolean; evidence: string }> = {};
  for (const a of Array.isArray(data?.answers) ? data.answers : []) {
    if (a && typeof a.id === "string") {
      returned[a.id] = {
        answer: a.answer === true,
        evidence: typeof a.evidence === "string" ? a.evidence : "",
      };
    }
  }

  const answers: Record<string, boolean> = {};
  const evidence: AiEvaluation["evidence"] = {};
  for (const q of input.criteria.flatMap((c) => c.questions)) {
    const r = returned[q.id];
    if (!r) {
      answers[q.id] = false;
      evidence[q.id] = { text: "", flag: "لم يجب النموذج عن هذا السؤال" };
      continue;
    }
    answers[q.id] = r.answer;
    let flag: string | undefined;
    if (r.answer && r.evidence && !found(input.text, r.evidence)) {
      flag = "الاقتباس غير موجود حرفيًا في النص";
    } else if (r.answer && !r.evidence && !q.text.includes("تجنب")) {
      flag = "نعم بلا دليل مقتبس";
    }
    evidence[q.id] = { text: r.evidence, flag };
  }

  const weaknesses: AiWeakness[] = (
    Array.isArray(data?.weaknesses) ? data.weaknesses : []
  )
    .slice(0, 3)
    .filter((w: any) => w && typeof w.problem === "string")
    .map((w: any) => ({
      quote: String(w.quote ?? ""),
      problem: String(w.problem),
      fix: String(w.fix ?? ""),
    }));

  return {
    model,
    createdAt: new Date().toISOString(),
    answers,
    evidence,
    weaknesses,
    strength: {
      quote: String(data?.strength?.quote ?? ""),
      why: String(data?.strength?.why ?? ""),
    },
  };
}

/** تقييم شامل للمناظرة كلها: نقاط ضعف كل كلمة وما كان ينبغي قوله، وما فات الطالب من حجج الخصم. */
export async function reviewDebate(
  settings: AiSettings,
  input: { topic: Topic; side: Side; transcript: Entry[] },
): Promise<DebateReview> {
  const { text: raw, model } = await callGemini(
    settings,
    buildReviewPrompt(input),
    true,
    true,
    REVIEW_SYSTEM,
    0.3,
    90000,
  );

  let data: any;
  try {
    data = parseJson(raw);
  } catch {
    throw new Error("جاء رد النموذج بصيغة غير صالحة. أعد المحاولة.");
  }

  const mine = input.transcript.filter((e) => e.mine);
  const opponentTexts = input.transcript.filter((e) => !e.mine).map((e) => e.text);
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

  const speeches = mine.map((e) => {
    const r = (Array.isArray(data?.speeches) ? data.speeches : []).find((x: any) => x?.turnId === e.turn.id);
    const weaknesses = (Array.isArray(r?.weaknesses) ? r.weaknesses : [])
      .slice(0, 3)
      .filter((w: any) => w && str(w.problem))
      .map((w: any) => ({
        quote: str(w.quote),
        problem: str(w.problem),
        shouldSay: str(w.shouldSay),
        verified: found(e.text, str(w.quote)),
      }));
    const q = str(r?.strength?.quote);
    return {
      turnId: e.turn.id,
      weaknesses,
      strength: { quote: q, why: str(r?.strength?.why), verified: found(e.text, q) },
    };
  });

  const missed = (Array.isArray(data?.missed) ? data.missed : [])
    .slice(0, 3)
    .filter((m: any) => m && str(m.shouldSay))
    .map((m: any) => ({
      opponentQuote: str(m.opponentQuote),
      shouldSay: str(m.shouldSay),
      verified: opponentTexts.some((t) => found(t, str(m.opponentQuote))),
    }));

  return {
    model,
    createdAt: new Date().toISOString(),
    summary: str(data?.summary),
    priorities: (Array.isArray(data?.priorities) ? data.priorities : []).map(str).filter(Boolean).slice(0, 3),
    speeches,
    missed,
  };
}
