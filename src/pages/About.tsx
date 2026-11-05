import { sideStyle, system, turnLabel } from "../lib/data";

export default function About() {
  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-3xl font-bold">عن النظام</h1>
        <p className="mt-3 rounded-lg border-s-4 border-gold bg-card p-3 text-sm text-gold">
          {system.status}
        </p>
      </header>

      <section>
        <h2 className="text-lg font-semibold">الترتيب</h2>
        <p className="mt-2 text-muted">
          ثلاثة متحدثين لكل فريق، وتتناوب الكلمات بين الفريقين. المناظرة كتابية في هذا الموقع. يُفرض عليك موقف المؤيد أو المعارض، وتكتب كلمات فريقك الثلاث بالترتيب.
        </p>
        <ol className="mt-3 flex flex-wrap gap-2">
          {system.order.map((t) => (
            <li key={t.id} className={`rounded-full px-3 py-1 text-sm font-semibold ${sideStyle[t.side].badge}`}>
              {turnLabel(t)}
            </li>
          ))}
        </ol>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">أدوار المتحدثين</h2>
        {Object.entries(system.roles).map(([n, role]) => (
          <article key={n} className="rounded-lg border border-line bg-card p-4">
            <h3 className="font-semibold">المتحدث {n}: {role.title}</h3>
            <p className="mt-1 text-sm text-muted">{role.description}</p>
            <ul className="mt-2 list-disc space-y-1 ps-5 text-sm">
              {role.tasks.map((task) => (
                <li key={task}>{task}</li>
              ))}
            </ul>
            {role.todo && <p className="mt-2 text-sm text-gold">{role.todo}</p>}
          </article>
        ))}
      </section>
    </div>
  );
}
