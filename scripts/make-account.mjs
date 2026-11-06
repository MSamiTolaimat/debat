#!/usr/bin/env node
// توليد حساب جديد أو تغيير كلمة مرور حساب موجود.
//
// الاستخدام:
//   node scripts/make-account.mjs <اسم_المستخدم> [كلمة_المرور]
//   node scripts/make-account.mjs --remove <اسم_المستخدم>
//   node scripts/make-account.mjs --list
//
// - بلا كلمة مرور: تُولَّد كلمة عشوائية قوية وتُعرض مرة واحدة فقط.
// - تُحفظ الـ hash فقط في accounts.local.json (مستبعد من git)، لا كلمات المرور.
// - في النهاية يُطبع السطر الكامل لمتغير ACCOUNTS. الصقه في Cloudflare:
//   Pages ← مشروعك ← Settings ← Variables and Secrets ← ACCOUNTS (نوع Secret) ثم أعد النشر.

import { createHash, randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const FILE = join(dirname(fileURLToPath(import.meta.url)), "..", "accounts.local.json");

const load = () => (existsSync(FILE) ? JSON.parse(readFileSync(FILE, "utf8")) : {});
const save = (obj) => writeFileSync(FILE, JSON.stringify(obj, null, 2) + "\n", { mode: 0o600 });

const sha256Hex = (s) => createHash("sha256").update(s, "utf8").digest("hex");

// أحرف بلا التباس (بلا 0/O و1/l/I) لسهولة نقل كلمة المرور للطالب
const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function randomPassword(len = 16) {
  const limit = 256 - (256 % ALPHABET.length);
  let out = "";
  while (out.length < len) {
    for (const b of randomBytes(len * 2)) {
      if (b < limit && out.length < len) out += ALPHABET[b % ALPHABET.length];
    }
  }
  return out;
}

function printEnv(accounts) {
  console.log("\nقيمة ACCOUNTS (الصقها كما هي في Cloudflare كـ Secret):\n");
  console.log(JSON.stringify(accounts));
  console.log("");
}

const args = process.argv.slice(2);
const accounts = load();

if (args[0] === "--list") {
  const names = Object.keys(accounts);
  console.log(names.length ? names.join("\n") : "لا حسابات.");
  if (names.length) printEnv(accounts);
  process.exit(0);
}

if (args[0] === "--remove") {
  const user = args[1];
  if (!user || !(user in accounts)) {
    console.error("الحساب غير موجود.");
    process.exit(1);
  }
  delete accounts[user];
  save(accounts);
  console.log(`حُذف الحساب: ${user}`);
  printEnv(accounts);
  process.exit(0);
}

const [user, given] = args;
if (!user || user.includes(":")) {
  console.error("الاستخدام: node scripts/make-account.mjs <اسم_المستخدم> [كلمة_المرور]\n(اسم المستخدم لا يحتوي على :)");
  process.exit(1);
}
if (given !== undefined && given.length < 12) {
  console.error("كلمة المرور قصيرة. استخدم 12 حرفًا على الأقل، أو اتركها فارغة لتُولَّد تلقائيًا.");
  process.exit(1);
}

const password = given ?? randomPassword();
const salt = randomBytes(16).toString("hex");
accounts[user] = `${salt}:${sha256Hex(`${salt}:${password}`)}`;
save(accounts);

console.log(`الحساب: ${user}`);
console.log(`كلمة المرور: ${password}`);
console.log("(تُعرض الآن فقط ولا تُحفظ في أي مكان. أرسلها لصاحبها.)");
printEnv(accounts);
