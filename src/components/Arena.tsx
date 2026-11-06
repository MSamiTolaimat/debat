import { sideStyle, system } from "../lib/data";
import { Equalizer } from "./DebateParts";
import type { Side } from "../types";

function Orb(props: { side: Side; you?: boolean; active: boolean; speaking: boolean }) {
  const st = sideStyle[props.side];
  return (
    <div className={`flex flex-col items-center gap-3 transition-all duration-500 ${props.active ? "scale-110" : "scale-90 opacity-50"}`}>
      <div
        className={`relative flex h-20 w-20 items-center justify-center rounded-full border-4 text-4xl ${st.badge} ${st.border} ${
          props.speaking ? (props.side === "pro" ? "ring-pro" : "ring-con") : ""
        }`}
      >
        <span aria-hidden="true">{props.you ? "🎤" : "🤺"}</span>
        {props.speaking && (
          <span className={`absolute -bottom-2 rounded-full border border-line bg-night px-2 py-1 ${st.text}`}>
            <Equalizer />
          </span>
        )}
      </div>
      <p className={`text-sm font-bold ${st.text}`}>
        {system.sides[props.side].label}
        {props.you ? " · أنت" : ""}
      </p>
    </div>
  );
}

/** حلبة المناظرة: فريقان يتواجهان، والمتكلم منهما يتوهج وتنبض حلقته. */
export default function Arena(props: {
  userSide: Side;
  active: "you" | "opp";
  speaking: "you" | "opp" | null;
  phase: string;
}) {
  const opp: Side = props.userSide === "pro" ? "con" : "pro";
  return (
    <section
      aria-label="حلبة المناظرة"
      className="relative overflow-hidden rounded-3xl border border-line bg-card px-4 pb-4 pt-6"
      style={{
        backgroundImage:
          "radial-gradient(ellipse 60% 70% at 15% 0%, rgba(20,184,166,.20), transparent 70%), radial-gradient(ellipse 60% 70% at 85% 0%, rgba(225,29,72,.20), transparent 70%)",
      }}
    >
      <div className="flex items-center justify-around">
        <Orb side={props.userSide} you active={props.active === "you"} speaking={props.speaking === "you"} />
        <span className="font-display text-4xl font-bold text-flame drop-shadow-[0_0_12px_rgba(249,115,22,.6)]">VS</span>
        <Orb side={opp} active={props.active === "opp"} speaking={props.speaking === "opp"} />
      </div>
      <p key={props.phase} role="status" aria-live="polite" className="fade-up mt-5 text-center text-lg font-bold">
        {props.phase}
      </p>
    </section>
  );
}
