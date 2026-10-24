"use client";

import { useId, useState } from "react";
import type { PlanCourse } from "@/contract/types";
import { EvidenceBar } from "./EvidenceBar";
import { IconChevronDown, IconStar } from "./Icons";
import { REASON_STYLES } from "./reasons";

interface CourseCardProps {
  course: PlanCourse;
  /** when highlight mode is on, non-goal-signal courses are dimmed */
  highlightGoal?: boolean;
}

export function CourseCard({ course, highlightGoal = false }: CourseCardProps) {
  const [open, setOpen] = useState(false);
  const detailsId = useId();
  const isSignal = course.reason === "goal_signal";
  const style = REASON_STYLES[course.reason] ?? REASON_STYLES.elective;
  const dimmed = highlightGoal && !isSignal;

  return (
    <li
      className={`rounded-lg border bg-white transition ${
        isSignal ? "border-amber-300" : "border-slate-200"
      } ${highlightGoal && isSignal ? "shadow-md ring-2 ring-amber-400" : ""} ${dimmed ? "opacity-45" : ""}`}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={detailsId}
        className="w-full rounded-lg p-3 text-left hover:bg-slate-50"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-wide text-slate-500">{course.code}</p>
            <p className="font-medium leading-snug text-slate-900">{course.title}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1 text-xs text-slate-500">
            <span className="tabular-nums">{course.credits} cr</span>
            <IconChevronDown className={`transition-transform ${open ? "rotate-180" : ""}`} />
          </div>
        </div>
        <span
          className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${style.badge}`}
        >
          {isSignal && <IconStar width={12} height={12} />}
          {course.reasonLabel || style.label}
        </span>
        <div className="mt-2">
          <EvidenceBar evidence={course.evidence} tone={isSignal ? "amber" : "indigo"} />
        </div>
      </button>
      {open && (
        <div id={detailsId} className="space-y-2 border-t border-slate-100 px-3 py-2.5 text-sm text-slate-600">
          <p>{course.description}</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
            <dt className="font-medium text-slate-500">Prerequisites</dt>
            <dd>{course.prereqs.length ? course.prereqs.join(", ") : "None"}</dd>
            <dt className="font-medium text-slate-500">Offered</dt>
            <dd>{course.termsOffered.join(", ")}</dd>
            {course.evidence.baselinePct !== null && (
              <>
                <dt className="font-medium text-slate-500">All alumni</dt>
                <dd>{course.evidence.baselinePct}% took it</dd>
              </>
            )}
          </dl>
        </div>
      )}
    </li>
  );
}
