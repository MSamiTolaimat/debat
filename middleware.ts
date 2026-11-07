// بوابة الدخول على Vercel (Routing Middleware): تعمل على خوادم Vercel قبل تقديم أي ملف من الموقع.
// صفحة دخول بنموذج، وبعد النجاح يُحفظ كوكي موقّع (HMAC) لمدة 30 يومًا فلا يُطلب الدخول كل مرة على الهاتف.
// المفتاح السري مشتق من ACCOUNTS نفسه: تغيير الحسابات أو كلمات السر يُنهي كل الجلسات القديمة.
// الحسابات في متغير بيئة اسمه ACCOUNTS (ليس في المستودع ولا في ملفات الموقع).
// الصيغة الأبسط: سطر لكل حساب بالشكل  اسم_المستخدم:كلمة_السر
//   sami:MyPass12345
//   ali:Another98765
// وتُقبل أيضًا صيغة JSON ({"sami":"MyPass12345"})، وقيم salt:hash التي يولّدها scripts/make-account.mjs.
// إن غاب المتغير أو كان فارغًا، يُغلق الموقع كله (لا يُفتح للجميع بالخطأ).
import { next } from "@vercel/functions";

declare const process: { env: Record<string, string | undefined> };

export const config = { matcher: "/:path*" };

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

const COOKIE = "debate_auth";
const MAX_AGE = 60 * 60 * 24 * 30;

const enc = new TextEncoder();

async function hmacHex(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}

const b64 = (s: string) => btoa(String.fromCharCode(...enc.encode(s)));
const unb64 = (s: string) => new TextDecoder().decode(Uint8Array.from(atob(s), (c) => c.charCodeAt(0)));

async function makeToken(accounts: Record<string, string>, user: string): Promise<string> {
  const payload = b64(user) + "." + (Math.floor(Date.now() / 1000) + MAX_AGE);
  const secret = await sha256Hex("sess:" + JSON.stringify(accounts));
  return payload + "." + (await hmacHex(secret, payload));
}

async function tokenOk(accounts: Record<string, string>, token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [u, exp, sig] = parts;
  try {
    const user = unb64(u);
    if (!Object.prototype.hasOwnProperty.call(accounts, user)) return false;
    if (!(Number(exp) > Date.now() / 1000)) return false;
    const secret = await sha256Hex("sess:" + JSON.stringify(accounts));
    return safeEqual(await hmacHex(secret, u + "." + exp), sig);
  } catch {
    return false;
  }
}

function getCookie(header: string | null, name: string): string | undefined {
  for (const part of (header ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return undefined;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function loginPage(error: string, status: number): Response {
  const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#0e1730">
<title>الدخول · مناظرة</title>
<style>
*{box-sizing:border-box}body{margin:0;min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:20px;background:#0e1730;color:#f4f6fb;font-family:system-ui,"Segoe UI",Tahoma,sans-serif}
form{width:100%;max-width:360px;background:#17234a;border:1px solid #2c3a66;border-radius:20px;padding:24px}
h1{margin:0 0 4px;font-size:28px;color:#fdba74;text-align:center}.intro{text-align:center}p{margin:0 0 16px;color:#a9b4cc;font-size:14px}
label{display:block;margin:12px 0 4px;font-size:14px}
input{width:100%;min-height:48px;padding:0 12px;font:inherit;font-size:16px;color:#f4f6fb;background:#0e1730;border:1px solid #2c3a66;border-radius:12px}
input:focus{outline:2px solid #f97316;border-color:#f97316}
button{margin-top:20px;width:100%;min-height:52px;border:0;border-radius:14px;background:#f97316;color:#0e1730;font:inherit;font-size:18px;font-weight:700}
.err{margin:12px 0 0;padding:10px;border-radius:10px;background:#4a1a33;color:#fb7185;font-size:14px}
a{color:#fdba74}
</style></head><body>
<form method="post" autocomplete="on">
<h1>مناظرة</h1><p class="intro">سجّل دخولك لمتابعة التدريب.</p>
${error ? `<div class="err" role="alert">${esc(error)}</div>` : ""}
<label for="u">اسم المستخدم</label>
<input id="u" name="username" autocomplete="username" autocapitalize="none" autocorrect="off" required>
<label for="p">كلمة السر</label>
<input id="p" name="password" type="password" autocomplete="current-password" required>
<button type="submit">دخول</button>
<p style="margin-top:16px">للحصول على حساب: <a href="https://t.me/Sami_Tulaimat" dir="ltr">@Sami_Tulaimat</a></p>
</form></body></html>`;
  return new Response(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export default async function middleware(request: Request): Promise<Response> {
  const accounts = parseAccounts(process.env.ACCOUNTS);
  if (!accounts) {
    return new Response("الموقع غير مهيأ بعد.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }

  if (await tokenOk(accounts, getCookie(request.headers.get("cookie"), COOKIE))) return next();

  if (request.method === "POST") {
    let user = "";
    let pass = "";
    try {
      const form = await request.formData();
      user = String(form.get("username") ?? "").trim();
      pass = String(form.get("password") ?? "");
    } catch {
      return loginPage("تعذر قراءة النموذج. أعد المحاولة.", 400);
    }
    const stored = Object.prototype.hasOwnProperty.call(accounts, user) ? accounts[user] : undefined;
    if (!(await passwordOk(stored, pass))) return loginPage("اسم المستخدم أو كلمة السر غير صحيحة.", 401);

    const url = new URL(request.url);
    const token = await makeToken(accounts, user);
    return new Response(null, {
      status: 303,
      headers: {
        Location: url.pathname + url.search,
        "Set-Cookie": `${COOKIE}=${token}; Max-Age=${MAX_AGE}; Path=/; HttpOnly; Secure; SameSite=Lax`,
        "Cache-Control": "no-store",
      },
    });
  }

  return loginPage("", 401);
}
