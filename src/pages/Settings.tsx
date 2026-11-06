import { useState } from "react";
import type { ReactNode } from "react";
import {
  DEFAULT_MODEL,
  getUsageToday,
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
import { loadPrefs, savePrefs } from "../lib/prefs";
import type { OppLength, Prefs, ReplyMode } from "../lib/prefs";

/** قسم قابل للفتح والإغلاق، وفي داخله صفوف تفصلها خطوط */
function Section(props: {
  id: string;
  title: string;
  hint: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={props.id} className="overflow-hidden rounded-2xl border border-line bg-card">
      <h2 id={props.id} className="m-0">
        <button
          type="button"
          aria-expanded={props.open}
          aria-controls={`${props.id}-content`}
          onClick={props.onToggle}
          className="btn flex min-h-16 w-full items-center justify-between gap-4 bg-night-2/60 px-4 py-3 text-start hover:bg-night-2 active:bg-flame/15"
        >
          <span>
            <span className="block font-display text-xl font-bold text-flame-soft">{props.title}</span>
            <span className="block text-sm font-normal text-muted">{props.hint}</span>
          </span>
          <span
            className={`shrink-0 text-2xl leading-none text-flame-soft transition-transform duration-200 ${
              props.open ? "rotate-180" : ""
            }`}
            aria-hidden="true"
          >
          ⌄
          </span>
        </button>
      </h2>
      {props.open && (
        <div id={`${props.id}-content`} className="divide-y divide-line border-t border-line">
          {props.children}
        </div>
      )}
    </section>
  );
}

/** صف إعداد: اسمه وشرحه، ثم عنصر التحكم تحته */
function Row(props: { title: string; hint?: string; children?: ReactNode }) {
  return (
    <div className="space-y-2 px-4 py-4">
      <p className="font-semibold">{props.title}</p>
      {props.hint && <p className="text-sm leading-6 text-muted">{props.hint}</p>}
      {props.children}
    </div>
  );
}

function Choice<T extends string>(props: {
  label: string;
  value: T;
  options: { value: T; text: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div role="group" aria-label={props.label} className="flex gap-2">
      {props.options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={props.value === o.value}
          onClick={() => props.onChange(o.value)}
          className={`btn min-h-12 flex-1 rounded-xl border px-3 text-base font-semibold ${
            props.value === o.value
              ? "border-flame bg-flame text-night"
              : "border-line bg-night hover:border-flame/60 active:bg-flame/25"
          }`}
        >
          {o.text}
        </button>
      ))}
    </div>
  );
}

/** مفتاح تشغيل وإيقاف */
function Switch(props: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={props.on}
      onClick={() => props.onChange(!props.on)}
      className="btn flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border border-line bg-night px-4 text-start active:bg-flame/20"
    >
      <span className="font-semibold">{props.label}</span>
      <span
        className={`flex h-7 w-12 shrink-0 items-center rounded-full p-1 transition-colors ${
          props.on ? "bg-flame" : "bg-line"
        }`}
        aria-hidden="true"
      >
        <span
          className={`h-5 w-5 rounded-full bg-white transition-transform ${props.on ? "-translate-x-5" : "translate-x-0"}`}
        />
      </span>
    </button>
  );
}

function Pill(props: { ok: boolean; text: string }) {
  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs font-semibold ${
        props.ok ? "border-pro/60 bg-pro-soft text-pro" : "border-line bg-night text-muted"
      }`}
    >
      {props.text}
    </span>
  );
}

export default function Settings() {
  const [openSection, setOpenSection] = useState("");
  const initial = loadAiSettings();
  const [key, setKey] = useState(initial?.key ?? "");
  const [model, setModel] = useState(initial?.model ?? DEFAULT_MODEL);
  const [saved, setSaved] = useState(!!initial?.key);
  const [show, setShow] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const updatePrefs = (p: Prefs) => {
    setPrefs(p);
    savePrefs(p);
  };
  const [usage, setUsage] = useState(getUsageToday);

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

  const current = () => ({ key: key.trim(), model: model.trim() || DEFAULT_MODEL });

  const save = async () => {
    const settings = current();
    saveAiSettings(settings);
    setSaved(!!settings.key);
    setBusy(true);
    setMessage(null);
    try {
      const used = await testKey(settings);
      setUsage(getUsageToday());
      setMessage({
        ok: true,
        text:
          used === settings.model
            ? "المفتاح والنموذج يعملان."
            : `المفتاح يعمل، لكن النموذج «${settings.model}» لم يستجب فاستُخدم البديل «${used}».`,
      });
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : "فشل الاختبار." });
    } finally {
      setBusy(false);
    }
  };

  const tts = ttsSupported();
  const dictation = dictationSupported();

  return (
    <div className="space-y-5 pb-4">
      <header className="space-y-3">
        <h1 className="font-display text-3xl font-bold">الإعدادات</h1>
        <div className="flex flex-wrap gap-2" aria-label="ملخص الحالة">
          <Pill ok={saved} text={saved ? "الذكاء الاصطناعي: مفعّل" : "الذكاء الاصطناعي: غير مفعّل"} />
          <Pill ok={dictation} text={dictation ? "الإملاء الصوتي: متاح" : "الإملاء الصوتي: غير متاح"} />
          <Pill ok={tts && arabicVoice !== false} text={tts && arabicVoice !== false ? "قراءة الخصم: متاحة" : "قراءة الخصم: غير متاحة"} />
        </div>
        <p className="text-sm text-muted">كل ما هنا يُحفظ في متصفحك على هذا الجهاز فقط.</p>
      </header>

      <Section
        id="s-train"
        title="التدريب"
        hint="كيف تريد أن تجري جلستك."
        open={openSection === "s-train"}
        onToggle={() => setOpenSection((current) => (current === "s-train" ? "" : "s-train"))}
      >
        <Row
          title="طريقة ردّك"
          hint={
            prefs.replyMode === "voice"
              ? "يظهر زر التحدث الكبير، وتظهر كلمتك أثناء كلامك. يمكنك الكتابة متى شئت."
              : "يُفتح حقل الكتابة مباشرة، ويبقى التحدث متاحًا بزر صغير."
          }
        >
          <Choice<ReplyMode>
            label="طريقة الرد"
            value={prefs.replyMode}
            onChange={(replyMode) => updatePrefs({ ...prefs, replyMode })}
            options={[
              { value: "voice", text: "بالصوت" },
              { value: "type", text: "بالكتابة" },
            ]}
          />
        </Row>
        <Row
          title="طول كلمة الخصم"
          hint="يُطبَّق على الكلمات التي يولّدها الذكاء الاصطناعي فقط. الكلمات الجاهزة تبقى بطولها."
        >
          <Choice<OppLength>
            label="طول كلمة الخصم"
            value={prefs.oppLength}
            onChange={(oppLength) => updatePrefs({ ...prefs, oppLength })}
            options={[
              { value: "short", text: "قصيرة" },
              { value: "medium", text: "متوسطة" },
              { value: "long", text: "طويلة" },
            ]}
          />
        </Row>
      </Section>

      <Section
        id="s-voice"
        title="الصوت"
        hint="قراءة كلمة الخصم بصوت مسموع."
        open={openSection === "s-voice"}
        onToggle={() => setOpenSection((current) => (current === "s-voice" ? "" : "s-voice"))}
      >
        {!tts ? (
          <Row title="القراءة بصوت مسموع" hint="غير مدعومة في هذا المتصفح. جرّب Chrome." />
        ) : (
          <>
            {arabicVoice === false && (
              <Row
                title="لا يوجد صوت عربي على جهازك"
                hint="ثبّت صوتًا عربيًا من إعدادات الهاتف (إعدادات تحويل النص إلى كلام)، وإلا قد يُقرأ النص بصوت غير عربي."
              />
            )}
            <Row title="قراءة الخصم تلقائيًا" hint="يتكلم الخصم بصوته ويظهر نصه مع الكلام.">
              <Switch
                label={voice.autoSpeak ? "مفعّلة" : "متوقفة"}
                on={voice.autoSpeak}
                onChange={(autoSpeak) => updateVoice({ ...voice, autoSpeak })}
              />
            </Row>
            <Row title={`سرعة القراءة: ${voice.rate.toFixed(1)}×`} hint="الأبطأ أوضح، والأسرع أقرب لمناظرة حقيقية.">
              <input
                id="rate"
                aria-label="سرعة القراءة"
                type="range"
                min={0.8}
                max={2}
                step={0.1}
                value={voice.rate}
                onChange={(e) => updateVoice({ ...voice, rate: Number(e.target.value) })}
                className="block w-full accent-[#f97316]"
              />
              <button type="button" onClick={tryVoice} className={ghostBtn}>
                جرّب الصوت
              </button>
            </Row>
          </>
        )}
        <Row
          title="الإملاء الصوتي (كلامك إلى نص)"
          hint={dictation ? "متاح في هذا المتصفح." : "غير مدعوم في هذا المتصفح. جرّب Chrome."}
        />
      </Section>

      <Section
        id="s-ai"
        title="الذكاء الاصطناعي"
        hint="مفتاح Gemini المجاني يولّد كلمات الخصم ويقيّم مناظرتك. بدونه تظهر كلمات جاهزة فقط ولا يتوفر التقييم."
        open={openSection === "s-ai"}
        onToggle={() => setOpenSection((current) => (current === "s-ai" ? "" : "s-ai"))}
      >
        <Row title="طريقة إنشاء مفتاح Gemini">
          <details open className="rounded-xl border border-line bg-night p-3 text-sm leading-7">
            <summary className="cursor-pointer font-semibold">خطوات إنشاء المفتاح ونسخه</summary>
            <ol className="mt-2 list-decimal space-y-2 ps-5">
              <li>
                افتح{" "}
                <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="underline">
                  Google AI Studio (استوديو Google للذكاء الاصطناعي)
                </a>{" "}
                وسجّل الدخول بحساب Google.
              </li>
              <li>
                اضغط زر <strong>إنشاء مفتاح API (Create API key)</strong>. قد يظهر باسم
                <strong> الحصول على مفتاح API (Get API key)</strong> في بعض نسخ الموقع.
              </li>
              <li>
                إذا طلب منك اختيار مشروع، اختر مشروعًا موجودًا أو اضغط
                <strong> إنشاء مشروع (Create project)</strong>، ثم أكّد إنشاء المفتاح.
              </li>
              <li>
                بجانب المفتاح اضغط <strong>نسخ (Copy)</strong> لنسخه، ولا تشارك المفتاح مع أي شخص.
              </li>
              <li>ارجع إلى هنا، والصق المفتاح في حقل «مفتاح Gemini»، ثم اضغط «حفظ» ليتم حفظه واختباره.</li>
            </ol>
            <p className="mt-2 text-muted">
              قد تختلف أسماء الأزرار أو ترتيبها قليلًا حسب لغة واجهة Google. يُحفظ المفتاح في متصفحك فقط،
              ولا يمر بأي خادم تابع للموقع؛ وتُرسل نصوصك مباشرة إلى Google.
            </p>
          </details>
        </Row>

        <Row title="مفتاح Gemini">
          <div className="flex gap-2">
            <input
              id="key"
              aria-label="مفتاح Gemini"
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
        </Row>

        <Row
          title="اسم النموذج"
          hint="ليست كل النماذج مجانية. تحقق من النموذج المتاح لحسابك في لوحة AI Studio، وغيّر الاسم إن ظهر خطأ «غير متاح»."
        >
          <input
            id="model"
            aria-label="اسم النموذج"
            dir="ltr"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className={field}
          />
        </Row>

        <Row title="الإجراءات">
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={save} disabled={!key.trim() || busy} className={primaryBtn}>
              {busy ? "جارٍ الحفظ والاختبار…" : "حفظ"}
            </button>
          </div>
          {message && (
            <p
              role="status"
              className={`rounded-lg border-s-4 bg-night p-3 text-sm ${message.ok ? "border-pro" : "border-con"}`}
            >
              {message.text}
            </p>
          )}
        </Row>
      </Section>

      <Section
        id="s-usage"
        title="الاستهلاك"
        hint="كم طلبًا أرسلت اليوم إلى Google."
        open={openSection === "s-usage"}
        onToggle={() => setOpenSection((current) => (current === "s-usage" ? "" : "s-usage"))}
      >
        <Row
          title={`طلبات اليوم: ${usage}`}
          hint="كل كلمة خصم وكل تقييم يُحسب طلبًا. حدّ حسابك غير معلن على صفحة Google الرسمية، فاطّلع عليه في لوحة AI Studio. يتصفّر العدّاد عند منتصف الليل بتوقيت المحيط الهادئ (حوالي العاشرة صباحًا بتوقيت الرياض)، ويعدّ طلبات هذا المتصفح فقط."
        >
          <button type="button" onClick={() => setUsage(getUsageToday())} className={ghostBtn}>
            حدّث العدّاد
          </button>
        </Row>
      </Section>
    </div>
  );
}
