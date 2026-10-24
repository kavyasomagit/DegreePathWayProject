import type { CourseReason } from "@/contract/types";

export const REASON_STYLES: Record<CourseReason, { badge: string; label: string }> = {
  goal_signal: { badge: "bg-amber-100 text-amber-900 ring-amber-300", label: "Strong signal for your goal" },
  major_core: { badge: "bg-indigo-100 text-indigo-800 ring-indigo-200", label: "Major requirement" },
  major_elective: { badge: "bg-sky-100 text-sky-800 ring-sky-200", label: "Major elective" },
  minor: { badge: "bg-violet-100 text-violet-800 ring-violet-200", label: "Minor" },
  prerequisite: { badge: "bg-teal-100 text-teal-800 ring-teal-200", label: "Prerequisite" },
  gen_ed: { badge: "bg-slate-100 text-slate-700 ring-slate-200", label: "University requirement" },
  elective: { badge: "bg-emerald-50 text-emerald-800 ring-emerald-200", label: "Elective" },
};

export const REASON_ORDER: CourseReason[] = [
  "goal_signal",
  "major_core",
  "major_elective",
  "minor",
  "prerequisite",
  "gen_ed",
  "elective",
];
