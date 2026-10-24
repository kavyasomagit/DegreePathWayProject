import Link from "next/link";
import { IconCap } from "./Icons";

const links = [
  { href: "/questionnaire", label: "Start" },
  { href: "/plan", label: "My plan" },
  { href: "/mentors", label: "Mentors" },
] as const;

export function Header() {
  return (
    <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 rounded-md font-semibold text-slate-900">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-600 text-white">
            <IconCap width={18} height={18} />
          </span>
          <span className="hidden sm:inline">Degree Pathway Suggester</span>
          <span className="sm:hidden">DPS</span>
        </Link>
        <nav aria-label="Main">
          <ul className="flex items-center gap-1 text-sm font-medium">
            {links.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="rounded-md px-3 py-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
