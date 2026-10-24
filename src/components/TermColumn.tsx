import type { PlanTerm } from "@/contract/types";
import { CourseCard } from "./CourseCard";

interface TermColumnProps {
  term: PlanTerm;
  highlightGoal: boolean;
}

export function TermColumn({ term, highlightGoal }: TermColumnProps) {
  return (
    <section
      aria-label={term.label}
      className="flex flex-col rounded-xl border border-slate-200 bg-slate-50/70 p-3"
    >
      <header className="mb-3 flex items-baseline justify-between px-1">
        <h4 className="font-semibold text-slate-900">{term.label}</h4>
        <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold tabular-nums text-slate-600 ring-1 ring-slate-200">
          {term.credits} credits
        </span>
      </header>
      {term.courses.length === 0 ? (
        <p className="px-1 text-sm text-slate-500">No courses scheduled.</p>
      ) : (
        <ul className="space-y-2">
          {term.courses.map((c) => (
            <CourseCard key={c.code} course={c} highlightGoal={highlightGoal} />
          ))}
        </ul>
      )}
    </section>
  );
}
