import { SYSTEM_INSTRUCTION, buildUserPrompt } from "./evaluatorPrompt";
import type { AiEvaluation, AiWeakness, Criterion, Topic, Turn } from "../types";

export interface AiSettings {
  key: string;
  model: string;
  consent: boolean;
}

// TODO: تحقق من اسم نموذج له مستوى مجاني في لوحة حسابك، ثم غيّره من صفحة الإعدادات.
export const DEFAULT_MODEL = "gemini-3.8-flash";

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const SETTINGS_KEY = "debate.gemini.v1";

export function loadAiSettings(): AiSettings | undefined {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? (JSON.parse(raw) as AiSettings) : undefined;
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

async function callGemini(
  settings: AiSettings,
  userText: string,
  withSystem: boolean,
  json: boolean,
  extra?: { system?: string; temperature?: number }
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);
  const body: Record<string, unknown> = {
    contents: [{ role: "user", parts: [{ text: userText }] }],
    generationConfig: {
      temperature: extra?.temperature ?? 0.2,
      maxOutputTokens: 8192,
      ...(json ? { responseMimeType: "application/json" } : {}),
    },
  };
  const sys = extra?.system ?? (withSystem ? SYSTEM_INSTRUCTION : undefined);
  if (sys) body.system_instruction = { parts: [{ text: sys }] };

  let res: Response;
  try {
    res = await fetch(`${BASE}/${encodeURIComponent(settings.model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": settings.key },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    if (controller.signal.aborted) throw new Error("انتهت المهلة. حاول مرة أخرى.");
    throw new Error("تعذر الاتصال بـ Google. تحقق من الإنترنت، وإن استمر فقد يمنع المتصفح الطلب (CORS).");
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new Error(await explain(res));

  const data = await res.json();
  const parts: Part[] = data?.candidates?.[0]?.content?.parts ?? [];
  const text = parts.filter((p) => !p.thought).map((p) => p.text ?? "").join("");
  if (!text) throw new Error("لم يرجع النموذج ردًا (ربما حُجب المحتوى). أعد المحاولة.");
  return text;
}

/** نص حر (غير JSON) بتعليمات نظام مخصصة، يُستعمل لتوليد كلام الفريق الخصم */
export async function generateText(
  settings: AiSettings,
  system: string,
  user: string,
  temperature = 0.9
): Promise<string> {
  return callGemini(settings, user, false, false, { system, temperature });
}

export async function testKey(settings: AiSettings): Promise<void> {
  await callGemini(settings, "Reply with the single word: ready", false, false);
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

const found = (text: string, quote: string) =>
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
  input: { topic: Topic; turn: Turn; criteria: Criterion[]; text: string; opponentText: string }
): Promise<AiEvaluation> {
  const raw = await callGemini(settings, buildUserPrompt(input), true, true);

  let data: any;
  try {
    data = parseJson(raw);
  } catch {
    throw new Error("جاء رد النموذج بصيغة غير صالحة. أعد المحاولة.");
  }

  const returned: Record<string, { answer: boolean; evidence: string }> = {};
  for (const a of Array.isArray(data?.answers) ? data.answers : []) {
    if (a && typeof a.id === "string") {
      returned[a.id] = { answer: a.answer === true, evidence: typeof a.evidence === "string" ? a.evidence : "" };
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

  const weaknesses: AiWeakness[] = (Array.isArray(data?.weaknesses) ? data.weaknesses : [])
    .slice(0, 3)
    .filter((w: any) => w && typeof w.problem === "string")
    .map((w: any) => ({
      quote: String(w.quote ?? ""),
      problem: String(w.problem),
      fix: String(w.fix ?? ""),
    }));

  return {
    model: settings.model,
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
