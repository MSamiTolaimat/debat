import { Link } from "react-router-dom";
import { primaryBtn } from "../lib/ui";
import { sideStyle, system, turnLabel } from "../lib/data";

export default function Home() {
  return (
    <div>
      <section>
        <h1 className="font-display text-4xl font-bold leading-tight sm:text-5xl">
          اكتب حجتك، وواجه كلام خصمك، واعرف ما تحسّنه
        </h1>
        <p className="mt-4 max-w-prose text-muted">
          تدريب كتابي على المناظرة بنظام الفرق الثلاثة. تختار موضوعًا فيُحدَّد لك موقف المؤيد أو المعارض، وتكتب كلمات فريقك الثلاث، ثم تقيّم كل كلمة بقائمة أسئلة محددة.
        </p>
        <Link to="/topics" className={`${primaryBtn} mt-6`}>
          ابدأ تدريبًا
        </Link>
      </section>

      <section aria-labelledby="order-h" className="mt-12">
        <h2 id="order-h" className="font-display text-2xl font-bold">
          ترتيب الكلمات
        </h2>
        <ol className="relative mt-5 space-y-3 before:absolute before:inset-y-0 before:start-1/2 before:w-px before:bg-line">
          {system.order.map((turn) => {
            const s = sideStyle[turn.side];
            const role = system.roles[String(turn.speaker)];
            return (
              <li
                key={turn.id}
                className={`relative flex ${
                  turn.side === "pro" ? "justify-start" : "justify-end"
                }`}
              >
                <div className={`w-[47%] rounded-lg border-s-4 bg-card p-3 ${s.border}`}>
                  <p className={`font-semibold ${s.text}`}>{turnLabel(turn)}</p>
                  <p className="text-sm text-muted">{role.title}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
