import type { ReactNode } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { system } from "../lib/data";
import Footer from "./Footer";

const icon = (d: ReactNode) => (
  <svg
    viewBox="0 0 24 24"
    width="24"
    height="24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {d}
  </svg>
);

const links = [
  {
    to: "/",
    label: "الرئيسية",
    end: true,
    icon: icon(<path d="M4 11 12 4l8 7v9a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" />),
  },
  {
    to: "/history",
    label: "السجل",
    end: false,
    icon: icon(
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
  },
  {
    to: "/settings",
    label: "الإعدادات",
    end: false,
    icon: icon(
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" />
      </>
    ),
  },
];

export default function Layout() {
  const { pathname } = useLocation();
  const isHome = pathname === "/" || pathname === "/new";

  return (
    <div className="flex min-h-dvh flex-col">
      {!isHome && (
        <header className="border-b border-line bg-night">
          <div className="mx-auto flex max-w-3xl items-center px-4 py-3">
            <NavLink
              to="/"
              className="font-display text-2xl font-bold text-flame-soft transition-colors hover:text-flame active:text-flame-deep"
            >
              {system.siteName}
            </NavLink>
          </div>
          <div className="h-0.5 bg-[linear-gradient(90deg,#2dd4bf,#f97316,#fb7185)]" aria-hidden="true" />
        </header>
      )}

      {isHome ? (
        <main className="flex-1">
          <Outlet />
        </main>
      ) : (
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
          <Outlet />
        </main>
      )}

      <Footer />

      <nav
        aria-label="التنقل الرئيسي"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-night pb-[env(safe-area-inset-bottom)]"
      >
        <ul className="mx-auto flex max-w-3xl">
          {links.map((l) => (
            <li key={l.to} className="flex-1">
              <NavLink
                to={l.to}
                end={l.end}
                className={({ isActive }) =>
                  `btn flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium active:bg-flame/15 ${
                    isActive ? "text-flame" : "text-white/60 hover:text-white"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      aria-hidden="true"
                      className={`absolute top-0 h-1 rounded-b-full bg-flame transition-all duration-300 ${
                        isActive ? "w-10 opacity-100" : "w-0 opacity-0"
                      }`}
                    />
                    <span className={`transition-transform duration-200 ${isActive ? "-translate-y-0.5 scale-110" : ""}`}>
                      {l.icon}
                    </span>
                    {l.label}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
