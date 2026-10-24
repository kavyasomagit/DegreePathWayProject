"use client";

import type { AdvisorResponse, AiErrorCode, Mentor } from "@/contract/types";
import { AiBadge, CopyButton, aiErrorMessage, mailtoHref } from "./ai";
import { IconInfo, IconMail } from "./Icons";
import { Skeleton } from "./ui";

export type AdvisorState =
  | { status: "loading" }
  | { status: "off" }
  | { status: "error"; code: AiErrorCode }
  | { status: "ready"; advisor: AdvisorResponse };

interface AdvisorCardProps {
  state: AdvisorState;
  major: string;
  mentors: Mentor[];
  onRetry: () => void;
}

export function AdvisorCard({ state, major, mentors, onRetry }: AdvisorCardProps) {
  if (state.status === "off") {
    return (
      <p className="flex items-center gap-2 text-sm text-slate-500">
        <IconInfo className="shrink-0" />
        AI advisor is off (no OpenAI key configured)
      </p>
    );
  }

  return (
    <section
      aria-labelledby="advisor-title"
      aria-busy={state.status === "loading"}
      className="rounded-xl border border-fuchsia-200 bg-linear-to-br from-fuchsia-50/70 to-white p-5 shadow-sm"
    >
      <div className="flex items-center gap-2">
        <h2 id="advisor-title" className="text-lg font-semibold text-slate-900">
          AI advisor
        </h2>
        <AiBadge />
      </div>

      {state.status === "loading" && (
        <div className="mt-3 space-y-3">
          <p className="text-sm font-medium text-slate-500" role="status">
            Your AI advisor is reviewing your plan…
          </p>
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-16 w-full" />
        </div>
      )}

      {state.status === "error" && (
        <div role="alert" className="mt-3 flex flex-wrap items-center gap-3">
          <p className="text-sm text-slate-700">{aiErrorMessage(state.code)}</p>
          <button
            type="button"
            onClick={onRetry}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Retry
          </button>
        </div>
      )}

      {state.status === "ready" && <AdvisorBody advisor={state.advisor} major={major} mentors={mentors} />}
    </section>
  );
}

function AdvisorBody({ advisor, major, mentors }: { advisor: AdvisorResponse; major: string; mentors: Mentor[] }) {
  const msg = advisor.mentorMessage;
  const mentorEmail = msg ? (mentors.find((m) => m.id === msg.mentorId)?.email ?? null) : null;
  const tips = [...advisor.termTips].sort((a, b) => a.term - b.term);

  return (
    <div className="mt-3 space-y-5">
      <p className="text-lg leading-relaxed text-slate-900">{advisor.summary}</p>

      {advisor.whyThisMajor && (
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Why {major} fits you</h3>
          <p className="mt-1 text-sm leading-relaxed text-slate-700">{advisor.whyThisMajor}</p>
        </div>
      )}

      {tips.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Term-by-term tips</h3>
          <ul className="mt-2 space-y-2">
            {tips.map((t) => (
              <li key={`${t.term}-${t.label}`} className="text-sm leading-relaxed text-slate-700">
                <span className="font-semibold text-slate-900">{t.label}:</span> {t.tip}
              </li>
            ))}
          </ul>
        </div>
      )}

      {msg && (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-900">Draft intro to {msg.mentorName}</h3>
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700">{msg.message}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <CopyButton text={msg.message} />
            {mentorEmail && (
              <a
                href={mailtoHref(mentorEmail, msg.message)}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                <IconMail />
                Email
              </a>
            )}
          </div>
        </div>
      )}

      <p className="border-t border-fuchsia-100 pt-3 text-xs text-slate-500">
        Written by OpenAI ({advisor.model}) using only the evidence on this page. Numbers come from the synthetic student
        data, not the AI.
      </p>
    </div>
  );
}
