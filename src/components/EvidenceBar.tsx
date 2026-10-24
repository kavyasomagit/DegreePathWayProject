import type { Evidence } from "@/contract/types";

interface EvidenceBarProps {
  evidence: Evidence;
  /** show the evidence sentence under the bar */
  showText?: boolean;
  tone?: "indigo" | "amber";
}

export function EvidenceBar({ evidence, showText = true, tone = "indigo" }: EvidenceBarProps) {
  const pct = evidence.total > 0 ? Math.round((evidence.count / evidence.total) * 100) : 0;
  const fill = tone === "amber" ? "bg-amber-500" : "bg-indigo-500";
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <div
          className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200"
          role="img"
          aria-label={`${evidence.count} of ${evidence.total} similar students`}
        >
          <div className={`h-full rounded-full ${fill}`} style={{ width: `${pct}%` }} />
        </div>
        <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-600">
          {evidence.count}/{evidence.total}
        </span>
      </div>
      {showText && <p className="text-xs leading-snug text-slate-500">{evidence.text}</p>}
    </div>
  );
}
