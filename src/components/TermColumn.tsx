import type { PlanTerm } from "@/contract/types";
import { CourseCard } from "./CourseCard";
import { IconSparkle } from "./Icons";

interface TermColumnProps {
  term: PlanTerm;
  highlightGoal: boolean;
  /** optional AI advisor tip for this term, shown as a callout above the courses */
  tip?: string;
}

export function TermColumn({ term, highlightGoal, tip }: TermColumnProps) {
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
      {tip && (
        <div className="mb-3 rounded-lg border border-fuchsia-200 bg-fuchsia-50 p-2.5 text-sm text-slate-800">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-fuchsia-800">
            <IconSparkle width={12} height={12} />
            Advisor tip
          </p>
          <p className="mt-1 leading-snug">{tip}</p>
        </div>
      )}
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
