import { NavLink, Outlet } from "react-router-dom";
import { system } from "../lib/data";

const links = [
  { to: "/", label: "الرئيسية", end: true },
  { to: "/topics", label: "المواضيع", end: false },
  { to: "/history", label: "السجل", end: false },
  { to: "/settings", label: "الإعدادات", end: false },
  { to: "/about", label: "عن النظام", end: false },
];

export default function Layout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-line bg-card">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3">
          <NavLink to="/" className="font-display text-2xl font-bold">
            {system.siteName}
          </NavLink>
          <nav className="flex gap-1 text-sm">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                className={({ isActive }) =>
                  `rounded-md px-3 py-2 ${
                    isActive ? "bg-ink text-white" : "text-muted hover:text-ink"
                  }`
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
