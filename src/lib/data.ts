import systemJson from "../data/system.json";
import topicsJson from "../data/topics.json";
import rubricJson from "../data/rubric.json";
import type { Criterion, Rubric, Side, SystemConfig, Topic, Turn } from "../types";

export const system = systemJson as unknown as SystemConfig;
export const topics = topicsJson as unknown as Topic[];
export const rubric = rubricJson as unknown as Rubric;

export const sideStyle: Record<
  Side,
  { badge: string; border: string; solid: string; text: string }
> = {
  pro: {
    badge: "bg-pro-soft text-pro",
    border: "border-pro",
    solid: "bg-pro text-white border-pro",
    text: "text-pro",
  },
  con: {
    badge: "bg-con-soft text-con",
    border: "border-con",
    solid: "bg-con text-white border-con",
    text: "text-con",
  },
};

/**
 * الموقف المفروض على الطالب في موضوع ما، أو null إن كان عشوائيًا.
 * "pro" أو "con" في system.json يفرضان موقفًا واحدًا على كل المواضيع (للاختبار).
 * "topic" يأخذ الموقف من حقل side في topics.json، وإن غاب عن موضوع فيكون عشوائيًا.
 */
export function fixedSide(topic: Topic | undefined): Side | null {
  const cfg = system.sideAssignment;
  if (cfg === "pro" || cfg === "con") return cfg;
  if (cfg === "topic" && (topic?.side === "pro" || topic?.side === "con")) return topic.side;
  return null;
}

export const turnLabel = (t: Turn) => `${system.sides[t.side].label} ${t.speaker}`;
export const getTopic = (id: string) => topics.find((t) => t.id === id);
export const getTurn = (id: string) => system.order.find((t) => t.id === id);

export function previousTurn(id: string): Turn | null {
  const i = system.order.findIndex((t) => t.id === id);
  return i > 0 ? system.order[i - 1] : null;
}

export function buildCriteria(turn: Turn, hasOpponent: boolean): Criterion[] {
  const role = system.roles[String(turn.speaker)];
  const base = rubric.criteria.filter((c) => !c.requiresOpponent || hasOpponent);
  const roleCriterion: Criterion = {
    id: "role",
    ...rubric.roleCriterion,
    questions: role.tasks.map((task, i) => ({
      id: `role${i}`,
      text: `هل أنجزتُ: ${task}؟`,
    })),
  };
  return [...base, roleCriterion];
}
