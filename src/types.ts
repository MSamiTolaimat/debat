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

export interface Evaluation {
  answers: Record<string, boolean>;
  strongestPoint: string;
  answeredIt: boolean | null;
  finishedAt: string;
}

export interface Session {
  id: string;
  teamId?: string;
  topicId: string;
  turnId: string;
  text: string;
  opponentText: string;
  createdAt: string;
  evaluation?: Evaluation;
  partnerEvaluation?: Evaluation;
  aiEvaluation?: AiEvaluation;
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
