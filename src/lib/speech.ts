import { useCallback, useEffect, useRef, useState } from "react";

/* ================= إعدادات الصوت ================= */

export interface VoiceSettings {
  /** يقرأ الموقع كلمة الخصم بصوت مسموع تلقائيًا */
  autoSpeak: boolean;
  /** سرعة القراءة: 1 عادية */
  rate: number;
}

const VOICE_KEY = "debate.voice.v2"; // v2: سرعة افتراضية أعلى، فتُهمل القيم القديمة
const DEFAULT_VOICE: VoiceSettings = { autoSpeak: true, rate: 1.3 };

/** سرعات يتنقل بينها زر السرعة */
export const RATE_STEPS = [1, 1.3, 1.6, 2];

export function loadVoice(): VoiceSettings {
  try {
    const raw = localStorage.getItem(VOICE_KEY);
    if (!raw) return DEFAULT_VOICE;
    const v = JSON.parse(raw) as Partial<VoiceSettings>;
    return {
      autoSpeak: typeof v.autoSpeak === "boolean" ? v.autoSpeak : DEFAULT_VOICE.autoSpeak,
      rate: typeof v.rate === "number" && v.rate >= 0.8 && v.rate <= 2 ? v.rate : DEFAULT_VOICE.rate,
    };
  } catch {
    return DEFAULT_VOICE;
  }
}

export function saveVoice(v: VoiceSettings) {
  try {
    localStorage.setItem(VOICE_KEY, JSON.stringify(v));
  } catch {
    /* تجاهل */
  }
}

/* ================= قراءة النص بصوت مسموع (TTS) ================= */

export const ttsSupported = () =>
  typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;

function pickArabicVoice(): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices();
  const ar = voices.filter((v) => /^ar([-_]|$)/i.test(v.lang));
  return (
    ar.find((v) => /^ar[-_]SA/i.test(v.lang) && !v.localService) ??
    ar.find((v) => /^ar[-_]SA/i.test(v.lang)) ??
    ar[0]
  );
}

/** true / false بعد تحميل الأصوات، وundefined قبل ذلك */
export function useArabicVoice(): boolean | undefined {
  const [has, setHas] = useState<boolean | undefined>(undefined);
  useEffect(() => {
    if (!ttsSupported()) return;
    const check = () => {
      const n = window.speechSynthesis.getVoices().length;
      if (n > 0) setHas(!!pickArabicVoice());
    };
    check();
    window.speechSynthesis.addEventListener("voiceschanged", check);
    // بعض المتصفحات لا تطلق الحدث، فنعطيها مهلة ثم نعدّ الأصوات غائبة
    const id = setTimeout(() => setHas((h) => (h === undefined ? !!pickArabicVoice() : h)), 1500);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", check);
      clearTimeout(id);
    };
  }, []);
  return has;
}

interface Chunk {
  start: number;
  end: number;
}

const MAX_CHUNK = 190;

/** يقسّم النص إلى مقاطع قصيرة عند نهايات الجمل، لأن Chrome يقطع النطق الطويل بعد نحو 15 ثانية. */
export function chunkText(text: string): Chunk[] {
  const out: Chunk[] = [];
  const sentences = text.match(/[^.؟!؛\n]+[.؟!؛\n]*/g) ?? [text];
  let pos = 0;
  let cur: Chunk | null = null;
  const push = () => {
    if (cur && text.slice(cur.start, cur.end).trim()) out.push(cur);
    cur = null;
  };
  for (const s of sentences) {
    const start = text.indexOf(s, pos);
    const from = start < 0 ? pos : start;
    const end = from + s.length;
    pos = end;
    if (cur && end - cur.start > MAX_CHUNK) push();
    if (end - from > MAX_CHUNK * 1.5) {
      // جملة طويلة جدًا: نقطعها عند آخر فراغ أو فاصلة
      push();
      let a = from;
      while (end - a > MAX_CHUNK) {
        const win = text.slice(a, a + MAX_CHUNK);
        const cut = Math.max(win.lastIndexOf("،"), win.lastIndexOf(" "));
        const b = a + (cut > 60 ? cut + 1 : MAX_CHUNK);
        out.push({ start: a, end: b });
        a = b;
      }
      cur = { start: a, end };
    } else if (!cur) {
      cur = { start: from, end };
    } else {
      cur.end = end;
    }
  }
  push();
  return out;
}

interface SpeakOptions {
  rate: number;
  /** عدد الأحرف التي نُطقت حتى الآن (يتقدم أثناء الكلام) */
  onProgress: (chars: number) => void;
  onEnd: () => void;
  onError: (message: string) => void;
}

/** يقرأ النص ويعيد دالة إلغاء. التقدم مبني على أحداث الكلمات إن وفّرها الصوت، وإلا على تقدير زمني. */
export function speak(text: string, opts: SpeakOptions): () => void {
  const synth = window.speechSynthesis;
  const chunks = chunkText(text);
  let cancelled = false;
  let timer: ReturnType<typeof setInterval> | undefined;
  let startTimer: ReturnType<typeof setTimeout> | undefined;

  const stopTimer = () => {
    if (timer) clearInterval(timer);
    timer = undefined;
  };

  const cancel = () => {
    cancelled = true;
    stopTimer();
    if (startTimer) clearTimeout(startTimer);
    synth.cancel();
  };

  if (chunks.length === 0) {
    opts.onEnd();
    return cancel;
  }

  synth.cancel();
  const voice = pickArabicVoice();
  let reached = 0;

  const playChunk = (i: number) => {
    if (cancelled) return;
    if (i >= chunks.length) {
      stopTimer();
      opts.onProgress(text.length);
      opts.onEnd();
      return;
    }
    const c = chunks[i];
    const u = new SpeechSynthesisUtterance(text.slice(c.start, c.end));
    u.lang = voice?.lang ?? "ar-SA";
    if (voice) u.voice = voice;
    u.rate = opts.rate;

    let boundary = 0;
    let startedAt = 0;
    const cps = 13 * opts.rate; // أحرف في الثانية، تقدير للاحتياط
    const report = (chars: number) => {
      const p = Math.min(c.end, c.start + Math.max(0, chars));
      if (p > reached) {
        reached = p;
        opts.onProgress(p);
      }
    };

    u.onstart = () => {
      if (cancelled) return;
      startedAt = Date.now();
      report(0);
      stopTimer();
      timer = setInterval(() => {
        const est = ((Date.now() - startedAt) / 1000) * cps;
        // لا نسبق الصوت كثيرًا: نتقدم بالتقدير لكن لا نتجاوز نهاية المقطع
        report(Math.max(boundary, Math.min(est, (c.end - c.start) * 0.95)));
      }, 120);
    };
    u.onboundary = (e) => {
      if (cancelled) return;
      const len = (e as SpeechSynthesisEvent & { charLength?: number }).charLength ?? 0;
      boundary = Math.max(boundary, e.charIndex + len);
      report(boundary);
    };
    u.onend = () => {
      if (cancelled) return;
      stopTimer();
      report(c.end - c.start);
      playChunk(i + 1);
    };
    u.onerror = (e) => {
      if (cancelled) return;
      stopTimer();
      if (e.error === "canceled" || e.error === "interrupted") return;
      cancelled = true;
      opts.onError(
        e.error === "not-allowed"
          ? "منع المتصفح تشغيل الصوت تلقائيًا. اضغط «استمع» لتشغيله."
          : "تعذر تشغيل الصوت على هذا الجهاز."
      );
    };
    synth.speak(u);
  };

  // Chrome يحتاج لحظة بعد cancel() وإلا يتجاهل الطلب التالي
  startTimer = setTimeout(() => playChunk(0), 60);
  return cancel;
}

export interface Speaker {
  /** مفتاح النص الذي يُقرأ الآن، أو null */
  activeKey: string | null;
  /** عدد الأحرف المنطوقة */
  progress: number;
  /** true: يُخفى غير المنطوق (أول مرة). false: يظهر النص كله ويُلوَّن المنطوق (إعادة الاستماع) */
  reveal: boolean;
  error: string;
  speakText: (key: string, text: string, rate: number, reveal: boolean) => void;
  stop: () => void;
}

export function useSpeaker(): Speaker {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [reveal, setReveal] = useState(true);
  const [error, setError] = useState("");
  const cancelRef = useRef<(() => void) | null>(null);

  const stop = useCallback(() => {
    cancelRef.current?.();
    cancelRef.current = null;
    setActiveKey(null);
  }, []);

  const speakText = useCallback(
    (key: string, text: string, rate: number, rev: boolean) => {
      if (!ttsSupported()) return;
      cancelRef.current?.();
      setError("");
      setReveal(rev);
      setProgress(0);
      setActiveKey(key);
      cancelRef.current = speak(text, {
        rate,
        onProgress: setProgress,
        onEnd: () => {
          cancelRef.current = null;
          setActiveKey((k) => (k === key ? null : k));
        },
        onError: (m) => {
          cancelRef.current = null;
          setError(m);
          setActiveKey((k) => (k === key ? null : k));
        },
      });
    },
    []
  );

  useEffect(
    () => () => {
      cancelRef.current?.();
    },
    []
  );

  return { activeKey, progress, reveal, error, speakText, stop };
}

/* ================= الإملاء الصوتي (تحويل كلام المستخدم إلى نص) ================= */

interface RecognitionResultItem {
  transcript: string;
}
interface RecognitionEvent {
  results: ArrayLike<ArrayLike<RecognitionResultItem>>;
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}


/** يوحّد الحروف المتشابهة ويحذف التشكيل ليقارن بين نسخ متتالية من الجملة نفسها */
const norm = (t: string) =>
  t
    .replace(/[\u064B-\u0652\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ")
    .trim();

/**
 * يدمج عناصر e.results في نص واحد.
 * على أندرويد يضيف المتصفح عنصرًا جديدًا مع كل تحديث، وكل عنصر يحوي الجملة المتراكمة كلها
 * («ارى» ثم «ارى المحكمة» ثم «ارى المحكمة عادلة»)، فلا يجوز ضمّها بالجمع.
 * وعلى سطح المكتب تكون العناصر أجزاءً منفصلة فتُضمّ. نميّز بينهما بأن العنصر المتراكم يبدأ بما قبله.
 */
export function mergeResults(parts: string[]): string {
  let out = "";
  for (const raw of parts) {
    const t = raw.trim();
    if (!t) continue;
    if (!out) {
      out = t;
      continue;
    }
    const a = norm(out);
    const b = norm(t);
    if (b.startsWith(a)) out = t; // نسخة أطول من نفسها: نستبدل
    else if (a.startsWith(b) || a.endsWith(b)) continue; // نسخة أقصر أو مكررة: نتجاهل
    else out += " " + t; // جزء جديد فعلًا
  }
  return out;
}

export const dictationSupported = () => !!recognitionCtor();

const dictationErrors: Record<string, string> = {
  "not-allowed": "لم يُسمح للمتصفح باستخدام الميكروفون. اسمح به من إعدادات الموقع ثم أعد المحاولة.",
  "service-not-allowed": "خدمة التعرف على الكلام غير مسموحة في هذا المتصفح.",
  "audio-capture": "لم يُعثر على ميكروفون.",
  network: "التعرف على الكلام يحتاج اتصالًا بالإنترنت.",
  "language-not-supported": "اللغة العربية غير مدعومة للإملاء في هذا المتصفح.",
};

/**
 * إملاء صوتي: يظهر الكلام نصًا داخل الحقل أثناء النطق.
 * يستمر بالاستماع حتى يضغط المستخدم إيقاف، ويعيد التشغيل تلقائيًا إن قطعه المتصفح بعد صمت.
 */
export function useDictation(opts: { getText: () => string; setText: (t: string) => void; max: number }) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const recRef = useRef<Recognition | null>(null);
  const wantRef = useRef(false);
  const baseRef = useRef("");
  const restartsRef = useRef<number[]>([]);

  const begin = useCallback(() => {
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = "ar-SA";
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    baseRef.current = optsRef.current.getText();

    rec.onresult = (e) => {
      if (recRef.current !== rec) return; // نتيجة متأخرة من جلسة انتهت
      const heard = mergeResults(Array.from({ length: e.results.length }, (_, i) => e.results[i][0]?.transcript ?? ""));
      if (!heard) return;
      const base = baseRef.current.replace(/\s+$/, "");
      const next = (base ? base + " " : "") + heard;
      optsRef.current.setText(next.slice(0, optsRef.current.max));
    };
    rec.onerror = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      wantRef.current = false;
      setError(dictationErrors[e.error] ?? "تعذر الإملاء الصوتي. أعد المحاولة.");
    };
    rec.onend = () => {
      if (recRef.current !== rec) return;
      if (!wantRef.current) {
        recRef.current = null;
        setListening(false);
        return;
      }
      // قطع المتصفح الاستماع (صمت أو حد زمني): نكمل، مع حماية من حلقة إعادة سريعة
      const now = Date.now();
      restartsRef.current = restartsRef.current.filter((t) => now - t < 5000).concat(now);
      if (restartsRef.current.length > 6) {
        wantRef.current = false;
        recRef.current = null;
        setListening(false);
        setError("توقف الإملاء الصوتي. اضغط الميكروفون لتكمل.");
        return;
      }
      setTimeout(() => {
        if (!wantRef.current || recRef.current !== rec) return;
        recRef.current = null;
        begin();
      }, 200);
    };

    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      recRef.current = null;
      wantRef.current = false;
      setListening(false);
    }
  }, []);

  const start = useCallback(() => {
    if (wantRef.current) return;
    setError("");
    restartsRef.current = [];
    wantRef.current = true;
    begin();
  }, [begin]);

  const stop = useCallback(() => {
    wantRef.current = false;
    const rec = recRef.current;
    if (rec) {
      try {
        rec.stop();
      } catch {
        /* تجاهل */
      }
    }
    setListening(false);
  }, []);

  useEffect(
    () => () => {
      wantRef.current = false;
      try {
        recRef.current?.abort();
      } catch {
        /* تجاهل */
      }
    },
    []
  );

  return { listening, error, start, stop, supported: dictationSupported() };
}
