import { IconCheck } from "./Icons";

interface StepIndicatorProps {
  steps: string[];
  current: number;
}

export function StepIndicator({ steps, current }: StepIndicatorProps) {
  return (
    <ol className="flex items-center gap-2 sm:gap-4" aria-label="Progress">
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="flex flex-1 items-center gap-2" aria-current={active ? "step" : undefined}>
            <span
              className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-semibold ${
                done
                  ? "bg-indigo-600 text-white"
                  : active
                    ? "bg-indigo-100 text-indigo-700 ring-2 ring-indigo-600"
                    : "bg-slate-100 text-slate-500"
              }`}
            >
              {done ? <IconCheck width={14} height={14} /> : i + 1}
              <span className="sr-only">{done ? " (completed)" : ""}</span>
            </span>
            <span
              className={`hidden text-sm font-medium sm:inline ${active ? "text-slate-900" : "text-slate-500"}`}
            >
              {label}
            </span>
            {i < steps.length - 1 && (
              <span className={`h-px flex-1 ${done ? "bg-indigo-600" : "bg-slate-200"}`} aria-hidden="true" />
            )}
          </li>
        );
      })}
    </ol>
  );
}
