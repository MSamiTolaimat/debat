export type Side = "pro" | "con";

export interface Turn {
  id: string;
  side: Side;
  speaker: number;
}

export interface Role {
  title: string;
  description: string;
  tasks: string[];
  todo?: string;
}

export interface SystemConfig {
  status: string;
  siteName: string;
  maxCharsPerSpeech: number;
  sideAssignment: "topic" | "random" | "pro" | "con";
  sides: Record<Side, { label: string }>;
  order: Turn[];
  roles: Record<string, Role>;
}

export interface Topic {
  id: string;
  title: string;
  category: string;
  difficulty: "سهل" | "متوسط" | "صعب";
  /** الموقف الذي تفرضه على الطالب في هذا الموضوع (يُستعمل عندما sideAssignment = "topic") */
  side?: Side;
  brief: string;
  sampleSpeech?: Partial<Record<Side, string>>;
  /**
   * بنك احتياطي لكلام الفريق الخصم (يُستعمل إن لم يتوفر الذكاء الاصطناعي).
   * لكل جانب عدة نسخ، وكل نسخة ثلاث كلمات بترتيب المتحدثين 1 و2 و3.
   */
  opponentSpeeches?: Partial<Record<Side, string[][]>>;
}

export interface Question {
  id: string;
  text: string;
}

export interface Criterion {
  id: string;
  title: string;
  hint: string;
  tip: string;
  requiresOpponent?: boolean;
  questions: Question[];
}

export interface Rubric {
  status: string;
  weakBelow: number;
  roleCriterion: { title: string; hint: string; tip: string };
  criteria: Criterion[];
}

export interface Session {
  id: string;
  teamId?: string;
  topicId: string;
  turnId: string;
  text: string;
  opponentText: string;
  createdAt: string;
  aiEvaluation?: AiEvaluation;
  /** الكلمة الختامية التي قالها الخصم بعد كلمة الطالب الأخيرة (على آخر كلمة فقط) */
  closingText?: string;
}

export interface AiWeakness {
  quote: string;
  problem: string;
  fix: string;
}

export interface AiEvaluation {
  model: string;
  createdAt: string;
  answers: Record<string, boolean>;
  evidence: Record<string, { text: string; flag?: string }>;
  weaknesses: AiWeakness[];
  strength: { quote: string; why: string };
}

export interface ReviewWeakness {
  quote: string;
  problem: string;
  /** ما كان ينبغي أن يقوله الطالب بدلًا من ذلك */
  shouldSay: string;
  /** هل وُجد الاقتباس حرفيًا في نص الطالب */
  verified: boolean;
}

export interface SpeechReview {
  turnId: string;
  weaknesses: ReviewWeakness[];
  strength: { quote: string; why: string; verified: boolean };
}

export interface MissedPoint {
  opponentQuote: string;
  shouldSay: string;
  verified: boolean;
}

/** تقييم الذكاء الاصطناعي للمناظرة كلها في نهاية التحدي */
export interface DebateReview {
  model: string;
  createdAt: string;
  summary: string;
  priorities: string[];
  speeches: SpeechReview[];
  missed: MissedPoint[];
}
