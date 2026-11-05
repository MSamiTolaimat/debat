import { useState } from "react";
import {
  DEFAULT_MODEL,
  clearAiSettings,
  loadAiSettings,
  saveAiSettings,
  testKey,
} from "../lib/gemini";
import { field, ghostBtn, primaryBtn } from "../lib/ui";

export default function Settings() {
  const initial = loadAiSettings();
  const [key, setKey] = useState(initial?.key ?? "");
  const [model, setModel] = useState(initial?.model ?? DEFAULT_MODEL);
  const [consent, setConsent] = useState(initial?.consent ?? false);
  const [show, setShow] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const current = () => ({ key: key.trim(), model: model.trim() || DEFAULT_MODEL, consent });

  const save = () => {
    saveAiSettings(current());
    setMessage({ ok: true, text: "تم الحفظ في متصفحك فقط." });
  };

  const remove = () => {
    clearAiSettings();
    setKey("");
    setConsent(false);
    setModel(DEFAULT_MODEL);
    setMessage({ ok: true, text: "حُذف المفتاح من متصفحك." });
  };

  const test = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await testKey(current());
      setMessage({ ok: true, text: "المفتاح والنموذج يعملان." });
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : "فشل الاختبار." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold">الإعدادات</h1>
        <p className="mt-2 text-muted">
          التقييم الذاتي وتقييم الشريك يعملان دائمًا. أضف مفتاحك المجاني لفتح التقييم بالذكاء الاصطناعي.
        </p>
      </header>

      <section className="rounded-lg border border-line bg-card p-4 text-sm leading-7">
        <p className="font-semibold">كيف تحصل على مفتاح</p>
        <ol className="mt-1 list-decimal space-y-1 ps-5">
          <li>
            افتح{" "}
            <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="underline">
              Google AI Studio
            </a>{" "}
            وسجّل بحساب Google.
          </li>
          <li>أنشئ مفتاحًا (Create API key) وانسخه.</li>
          <li>الصقه هنا واضغط «اختبر».</li>
        </ol>
        <p className="mt-2 text-muted">
          يُحفظ المفتاح في متصفحك فقط، ولا يمر بأي خادم تابع للموقع. تُرسل نصوصك مباشرة إلى Google.
        </p>
      </section>

      <section className="space-y-4">
        <div>
          <label htmlFor="key" className="font-semibold">مفتاح Gemini</label>
          <div className="mt-2 flex gap-2">
            <input
              id="key"
              dir="ltr"
              type={show ? "text" : "password"}
              autoComplete="off"
              spellCheck={false}
              value={key}
              onChange={(e) => setKey(e.target.value)}
              className={field}
            />
            <button type="button" onClick={() => setShow((v) => !v)} className={ghostBtn}>
              {show ? "إخفاء" : "إظهار"}
            </button>
          </div>
        </div>

        <div>
          <label htmlFor="model" className="font-semibold">اسم النموذج</label>
          <input
            id="model"
            dir="ltr"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className={`${field} mt-2`}
          />
          <p className="mt-1 text-sm text-muted">
            ليست كل النماذج مجانية. تحقق من النموذج المتاح لحسابك في لوحة AI Studio، وغيّر الاسم إن ظهر خطأ «غير متاح».
          </p>
        </div>

        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-1 h-5 w-5"
          />
          <span>
            أوافق أن نصوص كلماتي (للتقييم ولتوليد كلام الفريق الخصم) تُرسل إلى Google وتخضع لشروط المستوى المجاني، وقد تستخدمها Google لتحسين منتجاتها.
          </span>
        </label>

        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={save} disabled={!key.trim()} className={primaryBtn}>حفظ</button>
          <button type="button" onClick={test} disabled={!key.trim() || busy} className={ghostBtn}>
            {busy ? "جارٍ الاختبار…" : "اختبر"}
          </button>
          <button type="button" onClick={remove} className={ghostBtn}>احذف المفتاح</button>
        </div>

        {message && (
          <p
            role="status"
            className={`rounded-lg border-s-4 bg-card p-3 text-sm ${message.ok ? "border-pro" : "border-con"}`}
          >
            {message.text}
          </p>
        )}
      </section>
    </div>
  );
}
