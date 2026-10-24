"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type {
  AiErrorCode,
  CountItem,
  PlanTerm,
  QuestionnaireAnswers,
  RecommendationResponse,
} from "@/contract/types";
import { aiErrorCode, getAdvisor, getRecommendations } from "@/lib-client/api";
import { useAiEnabled, useHydrated, useStoredRaw } from "@/lib-client/hooks";
import {
  ADVISOR_KEY,
  ANSWERS_KEY,
  RESULT_KEY,
  answersKey,
  parseAdvisor,
  parseAnswers,
  parseResult,
  saveAdvisor,
  saveAnswers,
  saveResult,
} from "@/lib-client/storage";
import { AdvisorCard, type AdvisorState } from "@/components/AdvisorCard";
import { EvidenceBar } from "@/components/EvidenceBar";
import { MentorCard } from "@/components/MentorCard";
import { TermColumn } from "@/components/TermColumn";
import { IconAlert, IconArrowLeft, IconArrowRight, IconChevronDown, IconStar, IconUsers } from "@/components/Icons";
import { REASON_ORDER, REASON_STYLES } from "@/components/reasons";
import { Card, EmptyState, ErrorState, Skeleton, btnPrimary, btnSecondary } from "@/components/ui";

export function PlanView() {
  const hydrated = useHydrated();
  const answersRaw = useStoredRaw(ANSWERS_KEY);
  const resultRaw = useStoredRaw(RESULT_KEY);
  const answers = useMemo(() => parseAnswers(answersRaw), [answersRaw]);
  const key = answers ? answersKey(answers) : null;
  const cached = useMemo(() => parseResult(resultRaw), [resultRaw]);
  const result = cached && cached.key === key ? cached.response : null;

  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const error = failure && failure.key === key ? failure.message : null;

  const hasResult = result !== null;
  const hasError = error !== null;

  useEffect(() => {
    if (!answers || !key || hasResult || hasError) return;
    const ctrl = new AbortController();
    getRecommendations(answers, ctrl.signal)
      .then((r) => saveResult(key, r))
      .catch((e: unknown) => {
        if (!ctrl.signal.aborted)
          setFailure({ key, message: e instanceof Error ? e.message : "Could not build your plan." });
      });
    return () => ctrl.abort();
  }, [answers, key, attempt, hasResult, hasError]);

  if (!hydrated) return <PlanSkeleton />;
  if (!answers) {
    return (
      <EmptyState
        title="No plan yet"
        body="Answer a few quick questions about your goal, interests and background, and we'll build a term-by-term plan from students like you."
      />
    );
  }
  if (error) {
    return (
      <ErrorState
        message={error}
        onRetry={() => {
          setFailure(null);
          setAttempt((a) => a + 1);
        }}
      />
    );
  }
  if (!result) return <PlanSkeleton />;

  const choosePathway = (pathwayId: string | undefined) => {
    const next: QuestionnaireAnswers = { goal: answers.goal, interests: answers.interests, background: answers.background };
    if (pathwayId) next.pathwayId = pathwayId;
    if (answers.about) next.about = answers.about;
    saveAnswers(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <PlanResult
      result={result}
      answers={answers}
      answersKey={key ?? ""}
      overridden={Boolean(answers.pathwayId)}
      onChoosePathway={choosePathway}
    />
  );
}

/**
 * Loads the AI advisor for the current answers, separately from the plan so it never blocks it.
 * Uses the dps:advisor sessionStorage cache keyed by answersKey.
 */
function useAdvisor(answers: QuestionnaireAnswers, key: string): { state: AdvisorState; retry: () => void } {
  const aiEnabled = useAiEnabled();
  const advisorRaw = useStoredRaw(ADVISOR_KEY);
  const cached = useMemo(() => parseAdvisor(advisorRaw), [advisorRaw]);
  const advisor = cached && cached.key === key ? cached.response : null;
  const [failure, setFailure] = useState<{ key: string; code: AiErrorCode } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const failedCode = failure && failure.key === key ? failure.code : null;

  const hasAdvisor = advisor !== null;
  const hasFailure = failedCode !== null;

  useEffect(() => {
    if (aiEnabled !== true || hasAdvisor || hasFailure) return;
    const ctrl = new AbortController();
    getAdvisor(answers, ctrl.signal)
      .then((r) => saveAdvisor(key, r))
      .catch((e: unknown) => {
        if (!ctrl.signal.aborted) setFailure({ key, code: aiErrorCode(e) });
      });
    return () => ctrl.abort();
  }, [aiEnabled, answers, key, attempt, hasAdvisor, hasFailure]);

  const state: AdvisorState = advisor
    ? { status: "ready", advisor }
    : aiEnabled === false || failedCode === "not_configured"
      ? { status: "off" }
      : failedCode
        ? { status: "error", code: failedCode }
        : { status: "loading" };

  return {
    state,
    retry: () => {
      setFailure(null);
      setAttempt((a) => a + 1);
    },
  };
}

function PlanSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Building your plan">
      <p className="text-sm font-medium text-slate-500">Finding students like you and building your plan…</p>
      <Skeleton className="h-10 w-2/3" />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
      <Skeleton className="h-32" />
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-72" />
        ))}
      </div>
    </div>
  );
}

interface PlanResultProps {
  result: RecommendationResponse;
  answers: QuestionnaireAnswers;
  answersKey: string;
  overridden: boolean;
  onChoosePathway: (pathwayId: string | undefined) => void;
}

function PlanResult({ result, answers, answersKey: key, overridden, onChoosePathway }: PlanResultProps) {
  const advisor = useAdvisor(answers, key);
  const advisorResponse = advisor.state.status === "ready" ? advisor.state.advisor : null;
  const tipsByTerm = useMemo(() => {
    const map = new Map<number, string>();
    for (const t of advisorResponse?.termTips ?? []) if (t.tip && !map.has(t.term)) map.set(t.term, t.tip);
    return map;
  }, [advisorResponse]);
  const [highlightGoal, setHighlightGoal] = useState(false);
  const [showMethod, setShowMethod] = useState(false);
  const years = useMemo(() => groupByYear(result.plan), [result.plan]);
  const signalCount = result.plan.reduce(
    (n, t) => n + t.courses.filter((c) => c.reason === "goal_signal").length,
    0,
  );
  const creditPct = Math.min(100, Math.round((result.totalCredits / Math.max(1, result.creditsToGraduate)) * 100));

  return (
    <div className="space-y-10">
      {/* Summary */}
      <section aria-labelledby="plan-title" className="space-y-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-indigo-600">Your degree pathway</p>
            <h1 id="plan-title" className="mt-1 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Your plan to become {withArticle(result.goalLabel)}
            </h1>
          </div>
          <Link href="/questionnaire" className={btnSecondary}>
            Edit answers
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-indigo-200">
            <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
              {overridden ? "Major you chose" : "Recommended major"}
            </p>
            <h2 className="mt-1 text-2xl font-bold text-slate-900">{result.major.major}</h2>
            <p className="text-sm text-slate-500">
              {result.major.degree} · {result.major.college}
            </p>
            <p className="mt-3 text-sm leading-relaxed text-slate-700">{result.major.description}</p>
            <div className="mt-4">
              <EvidenceBar evidence={result.major.evidence} />
            </div>
            {overridden && (
              <button
                type="button"
                onClick={() => onChoosePathway(undefined)}
                className="mt-4 inline-flex items-center gap-1.5 rounded-md text-sm font-semibold text-indigo-700 hover:underline"
              >
                <IconArrowLeft />
                Back to the recommended major
              </button>
            )}
          </Card>
          <Card>
            <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">Recommended minor</p>
            {result.minor ? (
              <>
                <h2 className="mt-1 text-2xl font-bold text-slate-900">{result.minor.label}</h2>
                <div className="mt-4">
                  <EvidenceBar evidence={result.minor.evidence} />
                </div>
              </>
            ) : (
              <>
                <h2 className="mt-1 text-xl font-semibold text-slate-700">No minor recommended</h2>
                <p className="mt-2 text-sm text-slate-500">
                  Similar students did not share a common minor, so your free credits go to electives.
                </p>
              </>
            )}
            <div className="mt-5 border-t border-slate-100 pt-4">
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-medium text-slate-700">Total credits</span>
                <span className="font-semibold tabular-nums text-slate-900">
                  {result.totalCredits} / {result.creditsToGraduate}
                </span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-200" aria-hidden="true">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${creditPct}%` }} />
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {result.totalCredits >= result.creditsToGraduate
                  ? "Meets the credits needed to graduate."
                  : `${result.creditsToGraduate - result.totalCredits} more credits needed to graduate.`}
              </p>
            </div>
          </Card>
        </div>

        <AdvisorCard
          state={advisor.state}
          major={result.major.major}
          mentors={result.mentors}
          onRetry={advisor.retry}
        />

        {result.alternativeMajors.length > 0 && (
          <Card>
            <h2 className="font-semibold text-slate-900">Other majors similar students chose</h2>
            <ul className="mt-3 divide-y divide-slate-100">
              {result.alternativeMajors.map((m) => (
                <li key={m.pathwayId} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-900">
                      {m.major} <span className="text-sm font-normal text-slate-500">· {m.degree}</span>
                    </p>
                    <div className="mt-1 max-w-md">
                      <EvidenceBar evidence={m.evidence} />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onChoosePathway(m.pathwayId)}
                    className={`${btnSecondary} shrink-0 py-2`}
                  >
                    Plan with this major
                    <IconArrowRight />
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      <SimilarPanel result={result} />

      {/* Plan grid */}
      <section aria-labelledby="plan-grid-title" className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="plan-grid-title" className="text-2xl font-bold text-slate-900">
              Your 4-year plan
            </h2>
            <p className="text-sm text-slate-600">Click any course to see its description and prerequisites.</p>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">
            <input
              type="checkbox"
              role="switch"
              checked={highlightGoal}
              onChange={(e) => setHighlightGoal(e.target.checked)}
              className="h-4 w-4 accent-amber-500"
            />
            <IconStar width={14} height={14} />
            Highlight goal-signal courses ({signalCount})
          </label>
        </div>

        <ul className="flex flex-wrap gap-2" aria-label="Legend">
          {REASON_ORDER.map((r) => (
            <li
              key={r}
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${REASON_STYLES[r].badge}`}
            >
              {REASON_STYLES[r].label}
            </li>
          ))}
        </ul>

        {result.warnings.length > 0 && (
          <div role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="flex items-center gap-2 font-semibold">
              <IconAlert /> Some requirements could not be scheduled
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              {result.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-6">
          {years.map(({ year, terms }) => (
            <div key={year}>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-slate-500">Year {year}</h3>
              <div className="grid gap-4 md:grid-cols-2">
                {terms.map((t) => (
                  <TermColumn key={t.term} term={t} highlightGoal={highlightGoal} tip={tipsByTerm.get(t.term)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Methodology */}
      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <button
          type="button"
          aria-expanded={showMethod}
          aria-controls="methodology"
          onClick={() => setShowMethod((s) => !s)}
          className="flex w-full items-center justify-between rounded-xl px-5 py-4 text-left font-semibold text-slate-900 hover:bg-slate-50"
        >
          Why these recommendations?
          <IconChevronDown className={`transition-transform ${showMethod ? "rotate-180" : ""}`} />
        </button>
        {showMethod && (
          <div id="methodology" className="border-t border-slate-100 px-5 py-4">
            <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-slate-700">
              {result.methodology.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-slate-500">{result.syntheticNote}</p>
          </div>
        )}
      </section>

      {result.clubs.length > 0 && (
        <section aria-labelledby="clubs-title">
          <h2 id="clubs-title" className="text-2xl font-bold text-slate-900">
            Clubs similar students joined
          </h2>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {result.clubs.map((c) => (
              <li key={c.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h3 className="font-semibold text-slate-900">{c.name}</h3>
                <p className="mt-1 text-sm text-slate-600">{c.description}</p>
                <div className="mt-3">
                  <EvidenceBar evidence={c.evidence} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {result.mentors.length > 0 && (
        <section aria-labelledby="mentors-title">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 id="mentors-title" className="text-2xl font-bold text-slate-900">
                Mentors who walked this path
              </h2>
              <p className="text-sm text-slate-600">Alumni and seniors matched to your goal and major.</p>
            </div>
            <Link href="/mentors" className={btnPrimary}>
              See all mentors
              <IconArrowRight />
            </Link>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {result.mentors.slice(0, 3).map((m) => (
              <MentorCard
                key={m.id}
                mentor={m}
                introMessage={
                  advisorResponse?.mentorMessage?.mentorId === m.id ? advisorResponse.mentorMessage.message : undefined
                }
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function SimilarPanel({ result }: { result: RecommendationResponse }) {
  const s = result.similar;
  return (
    <section aria-labelledby="similar-title" className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-5">
      <h2 id="similar-title" className="flex items-center gap-2 text-lg font-semibold text-slate-900">
        <IconUsers className="text-indigo-600" />
        Based on {s.cohortSize} similar students who became {withArticle(s.goalLabel)}
      </h2>
      <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <CountList title="Top majors" items={s.majors} total={s.cohortSize} />
        <CountList title="Job titles" items={s.jobTitles} total={s.cohortSize} />
        <CountList title="Employers" items={s.employers} total={s.cohortSize} />
        <div className="space-y-3">
          <Stat value={s.gradSchoolCount} label={`of ${s.cohortSize} went to grad school`} />
          <Stat value={s.seniorsWithSameGoal} label="current seniors share your goal" />
        </div>
      </div>
    </section>
  );
}

function CountList({ title, items, total }: { title: string; items: CountItem[]; total: number }) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">No data</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {items.slice(0, 5).map((i) => (
            <li key={i.label} className="text-sm">
              <div className="flex justify-between gap-2">
                <span className="truncate text-slate-800">{i.label}</span>
                <span className="shrink-0 tabular-nums text-slate-500" aria-label={`${i.count} of ${total}`}>
                  {i.count}
                </span>
              </div>
              <div className="mt-0.5 h-1 rounded-full bg-indigo-100" aria-hidden="true">
                <div className="h-full rounded-full bg-indigo-400" style={{ width: `${(i.count / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-lg bg-white p-3 ring-1 ring-indigo-100">
      <p className="text-2xl font-bold tabular-nums text-indigo-700">{value}</p>
      <p className="text-sm text-slate-600">{label}</p>
    </div>
  );
}

function groupByYear(plan: PlanTerm[]): { year: number; terms: PlanTerm[] }[] {
  const years = new Map<number, PlanTerm[]>();
  for (const t of [...plan].sort((a, b) => a.term - b.term)) {
    const y = Math.ceil(t.term / 2);
    years.set(y, [...(years.get(y) ?? []), t]);
  }
  return [...years.entries()].map(([year, terms]) => ({ year, terms }));
}

function withArticle(label: string): string {
  return /^[aeiou]/i.test(label) ? `an ${label}` : `a ${label}`;
}
