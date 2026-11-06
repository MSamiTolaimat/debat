// بوابة الدخول: تعمل على خوادم Cloudflare قبل تقديم أي ملف من الموقع.
// الحسابات في متغير سري اسمه ACCOUNTS (وليس في المستودع ولا في ملفات الموقع).
// صيغته: {"اسم_المستخدم":"salt:hash", ...} وتولّده scripts/make-account.mjs.
// إن غاب المتغير أو فسد، يُغلق الموقع كله (لا يُفتح للجميع بالخطأ).

interface Env {
  ACCOUNTS?: string;
}

interface Ctx {
  request: Request;
  env: Env;
  next: () => Promise<Response>;
}

const REALM = 'Basic realm="debate", charset="UTF-8"';

const hex = (buf: ArrayBuffer) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

async function sha256Hex(text: string): Promise<string> {
  return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
}

// مقارنة بزمن ثابت لا يكشف عدد الأحرف الصحيحة
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function parseAccounts(raw: string | undefined): Record<string, string> | null {
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return null;
    const out: Record<string, string> = {};
    for (const [user, value] of Object.entries(obj)) {
      if (typeof value === "string" && /^[0-9a-f]+:[0-9a-f]{64}$/.test(value)) out[user] = value;
    }
    return Object.keys(out).length > 0 ? out : null;
  } catch {
    return null;
  }
}

function parseBasic(header: string | null): { user: string; pass: string } | null {
  if (!header || !header.startsWith("Basic ")) return null;
  try {
    const bin = atob(header.slice(6).trim());
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const decoded = new TextDecoder().decode(bytes);
    const i = decoded.indexOf(":");
    if (i < 0) return null;
    return { user: decoded.slice(0, i), pass: decoded.slice(i + 1) };
  } catch {
    return null;
  }
}

const unauthorized = () =>
  new Response("الدخول مطلوب", {
    status: 401,
    headers: {
      "WWW-Authenticate": REALM,
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });

export const onRequest = async ({ request, env, next }: Ctx): Promise<Response> => {
  const accounts = parseAccounts(env.ACCOUNTS);
  if (!accounts) {
    return new Response("الموقع غير مهيأ بعد.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }

  const cred = parseBasic(request.headers.get("Authorization"));
  if (!cred) return unauthorized();

  const stored = Object.prototype.hasOwnProperty.call(accounts, cred.user)
    ? accounts[cred.user]
    : undefined;
  // نحسب الـ hash دائمًا ولو كان المستخدم غير موجود، حتى لا يختلف الزمن
  const [salt, expected] = (stored ?? "00:" + "0".repeat(64)).split(":");
  const actual = await sha256Hex(salt + ":" + cred.pass);

  if (!stored || !safeEqual(actual, expected)) return unauthorized();
  return next();
};
