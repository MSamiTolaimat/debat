// بوابة الدخول على Vercel (Routing Middleware): تعمل على خوادم Vercel قبل تقديم أي ملف من الموقع.
// الحسابات في متغير بيئة اسمه ACCOUNTS (ليس في المستودع ولا في ملفات الموقع).
// الصيغة الأبسط: سطر لكل حساب بالشكل  اسم_المستخدم:كلمة_السر
//   sami:MyPass12345
//   ali:Another98765
// وتُقبل أيضًا صيغة JSON ({"sami":"MyPass12345"})، وقيم salt:hash التي يولّدها scripts/make-account.mjs.
// إن غاب المتغير أو كان فارغًا، يُغلق الموقع كله (لا يُفتح للجميع بالخطأ).
import { next } from "@vercel/functions";

declare const process: { env: Record<string, string | undefined> };

export const config = { matcher: "/:path*" };

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

const HASHED = /^[0-9a-f]+:[0-9a-f]{64}$/;

function parseAccounts(raw: string | undefined): Record<string, string> | null {
  const text = raw?.trim();
  if (!text) return null;
  const out: Record<string, string> = {};
  if (text.startsWith("{")) {
    try {
      const obj = JSON.parse(text);
      if (!obj || typeof obj !== "object" || Array.isArray(obj)) return null;
      for (const [user, value] of Object.entries(obj)) {
        if (user && typeof value === "string" && value.length > 0) out[user] = value;
      }
    } catch {
      return null;
    }
  } else {
    for (const line of text.split(/\r?\n/)) {
      const l = line.trim();
      if (!l || l.startsWith("#")) continue;
      const i = l.indexOf(":");
      if (i <= 0) continue;
      const user = l.slice(0, i).trim();
      const value = l.slice(i + 1).trim();
      if (user && value) out[user] = value;
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}

// القيمة المخزنة إما بصمة salt:hash أو كلمة سر صريحة، وكلاهما يُقارن بزمن ثابت
async function passwordOk(stored: string | undefined, pass: string): Promise<boolean> {
  if (stored !== undefined && HASHED.test(stored)) {
    const [salt, expected] = stored.split(":");
    return safeEqual(await sha256Hex(salt + ":" + pass), expected);
  }
  const expected = await sha256Hex("p:" + (stored ?? ""));
  const actual = await sha256Hex("p:" + pass);
  return stored !== undefined && safeEqual(actual, expected);
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
  new Response("الدخول مطلوب. للحصول على حساب تواصل مع المطوّر عبر تيليجرام: @Sami_Tulaimat", {
    status: 401,
    headers: {
      "WWW-Authenticate": REALM,
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });

export default async function middleware(request: Request): Promise<Response> {
  const accounts = parseAccounts(process.env.ACCOUNTS);
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

  if (!(await passwordOk(stored, cred.pass))) return unauthorized();
  return next();
}
