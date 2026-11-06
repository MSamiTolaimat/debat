import { useState } from "react";
import {
  DEFAULT_MODEL,
  clearAiSettings,
  loadAiSettings,
  saveAiSettings,
  testKey,
} from "../lib/gemini";
import { field, ghostBtn, primaryBtn } from "../lib/ui";
import {
  dictationSupported,
  loadVoice,
  saveVoice,
  speak,
  ttsSupported,
  useArabicVoice,
} from "../lib/speech";
import type { VoiceSettings } from "../lib/speech";

export default function Settings() {
  const initial = loadAiSettings();
  const [key, setKey] = useState(initial?.key ?? "");
  const [model, setModel] = useState(initial?.model ?? DEFAULT_MODEL);
  const [consent, setConsent] = useState(initial?.consent ?? false);
  const [show, setShow] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const [voice, setVoice] = useState<VoiceSettings>(loadVoice);
  const arabicVoice = useArabicVoice();
  const updateVoice = (v: VoiceSettings) => {
    setVoice(v);
    saveVoice(v);
  };
  const tryVoice = () =>
    speak("سيدي الرئيس، هذا اختبار لصوت الخصم. إن سمعتني بوضوح فالصوت يعمل على جهازك.", {
      rate: voice.rate,
      onProgress: () => {},
      onEnd: () => {},
      onError: (m) => setMessage({ ok: false, text: m }),
    });

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
      const used = await testKey(current());
      setMessage({
        ok: true,
        text:
          used === current().model
            ? "المفتاح والنموذج يعملان."
            : `المفتاح يعمل، لكن النموذج «${current().model}» لم يستجب فاستُخدم البديل «${used}».`,
      });
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
          أضف مفتاح Gemini المجاني ليولّد الموقع كلمات الخصم ويقيّم مناظرتك كاملة بالذكاء الاصطناعي. بدونه تظهر كلمات جاهزة فقط ولا يتوفر التقييم.
        </p>
      </header>

      <section className="space-y-3 rounded-lg border border-line bg-card p-4 text-sm leading-7">
        <h2 className="text-lg font-semibold">الصوت</h2>
        <ul className="space-y-1">
          <li>الإملاء الصوتي (كلامك إلى نص): {dictationSupported() ? "متاح ✓" : "غير مدعوم في هذا المتصفح ✗"}</li>
          <li>
            قراءة الخصم بصوت مسموع:{" "}
            {!ttsSupported()
              ? "غير مدعومة في هذا المتصفح ✗"
              : arabicVoice === false
                ? "متاحة لكن لا يوجد صوت عربي مثبّت على جهازك ⚠"
                : "متاحة ✓"}
          </li>
        </ul>
        {ttsSupported() && (
          <>
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={voice.autoSpeak}
                onChange={(e) => updateVoice({ ...voice, autoSpeak: e.target.checked })}
                className="mt-1 h-5 w-5"
              />
              <span>اقرأ كلمة الخصم بصوت مسموع تلقائيًا</span>
            </label>
            <div>
              <label htmlFor="rate" className="font-semibold">
                سرعة القراءة: {voice.rate.toFixed(1)}×
              </label>
              <input
                id="rate"
                type="range"
                min={0.8}
                max={2}
                step={0.1}
                value={voice.rate}
                onChange={(e) => updateVoice({ ...voice, rate: Number(e.target.value) })}
                className="mt-2 block w-full"
              />
            </div>
            <button type="button" onClick={tryVoice} className={ghostBtn}>
              🔊 جرّب الصوت
            </button>
          </>
        )}
      </section>

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
            أوافق أن نص كلمتي يُرسل إلى Google ويخضع لشروط المستوى المجاني، وقد تستخدمه Google لتحسين منتجاتها.
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
