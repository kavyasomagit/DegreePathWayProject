"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { OptionsResponse, QuestionnaireAnswers } from "@/contract/types";
import { getOptions } from "@/lib-client/api";
import { useHydrated, useStoredRaw } from "@/lib-client/hooks";
import { ANSWERS_KEY, clearResult, parseAnswers, saveAnswers } from "@/lib-client/storage";
import { Chip } from "@/components/Chip";
import { StepIndicator } from "@/components/StepIndicator";
import { IconArrowLeft, IconArrowRight, IconCheck, IconSearch } from "@/components/Icons";
import { ErrorState, Skeleton, btnPrimary, btnSecondary } from "@/components/ui";

const STEPS = ["Goal", "Interests", "Background"];
const MAX_INTERESTS = 4;
const MAX_BACKGROUND = 3;

export function Questionnaire() {
  const hydrated = useHydrated();
  const answersRaw = useStoredRaw(ANSWERS_KEY);
  const [options, setOptions] = useState<OptionsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    getOptions(ctrl.signal)
      .then(setOptions)
      .catch((e: unknown) => {
        if (!ctrl.signal.aborted) setError(e instanceof Error ? e.message : "Could not load options.");
      });
    return () => ctrl.abort();
  }, [attempt]);

  if (error) {
    return (
      <ErrorState
        message={error}
        onRetry={() => {
          setError(null);
          setAttempt((a) => a + 1);
        }}
      />
    );
  }

  if (!options || !hydrated) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading questionnaire">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-10 w-2/3" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {Array.from({ length: 9 }, (_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      </div>
    );
  }

  return <QuestionnaireForm options={options} initial={parseAnswers(answersRaw)} />;
}

interface FormProps {
  options: OptionsResponse;
  initial: QuestionnaireAnswers | null;
}

function QuestionnaireForm({ options, initial }: FormProps) {
  const router = useRouter();
  const valid = (ids: string[] | undefined, list: { id: string }[], max: number) =>
    (ids ?? []).filter((id) => list.some((o) => o.id === id)).slice(0, max);

  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState<string>(
    initial && options.goals.some((g) => g.id === initial.goal) ? initial.goal : "",
  );
  const [interests, setInterests] = useState<string[]>(valid(initial?.interests, options.interests, MAX_INTERESTS));
  const [background, setBackground] = useState<string[]>(
    valid(initial?.background, options.background, MAX_BACKGROUND),
  );
  const [query, setQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const filteredGoals = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.goals.filter((g) => g.label.toLowerCase().includes(q)) : options.goals;
  }, [options.goals, query]);

  const toggle = (list: string[], id: string, max: number) =>
    list.includes(id) ? list.filter((x) => x !== id) : list.length < max ? [...list, id] : list;

  const canNext = step === 0 ? goal !== "" : step === 1 ? interests.length >= 1 : true;

  function submit(bg: string[]) {
    setSubmitting(true);
    saveAnswers({ goal, interests, background: bg });
    clearResult();
    router.push("/plan");
  }

  return (
    <div className="mx-auto max-w-3xl">
      <StepIndicator steps={STEPS} current={step} />

      <form
        className="mt-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8"
        onSubmit={(e) => {
          e.preventDefault();
          if (!canNext) return;
          if (step < STEPS.length - 1) setStep(step + 1);
          else submit(background);
        }}
      >
        {step === 0 && (
          <fieldset>
            <legend className="text-2xl font-bold text-slate-900">What do you want to do after graduating?</legend>
            <p className="mt-1 text-slate-600">Pick one career goal. You can change it later.</p>
            <label htmlFor="goal-search" className="sr-only">
              Search goals
            </label>
            <div className="relative mt-5">
              <IconSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id="goal-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search goals, e.g. analyst, nurse, engineer"
                className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3 text-sm placeholder:text-slate-400 focus:border-indigo-500"
              />
            </div>
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
              {filteredGoals.map((g) => {
                const selected = goal === g.id;
                return (
                  <button
                    key={g.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setGoal(g.id)}
                    className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-3 text-left text-sm font-medium transition-colors ${
                      selected
                        ? "border-indigo-600 bg-indigo-50 text-indigo-900 ring-1 ring-indigo-600"
                        : "border-slate-200 text-slate-700 hover:border-indigo-300 hover:bg-slate-50"
                    }`}
                  >
                    {g.label}
                    {selected && <IconCheck className="shrink-0 text-indigo-600" />}
                  </button>
                );
              })}
            </div>
            {filteredGoals.length === 0 && (
              <p className="mt-4 text-sm text-slate-500">No goals match &ldquo;{query}&rdquo;.</p>
            )}
          </fieldset>
        )}

        {step === 1 && (
          <fieldset>
            <legend className="text-2xl font-bold text-slate-900">What are you interested in?</legend>
            <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-slate-600">Choose 1 to 4 topics.</p>
              <p
                className={`text-sm font-semibold tabular-nums ${interests.length === MAX_INTERESTS ? "text-indigo-700" : "text-slate-500"}`}
                aria-live="polite"
              >
                {interests.length}/{MAX_INTERESTS} selected
              </p>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {options.interests.map((o) => {
                const selected = interests.includes(o.id);
                return (
                  <Chip
                    key={o.id}
                    label={o.label}
                    selected={selected}
                    disabled={!selected && interests.length >= MAX_INTERESTS}
                    onToggle={() => setInterests((l) => toggle(l, o.id, MAX_INTERESTS))}
                  />
                );
              })}
            </div>
          </fieldset>
        )}

        {step === 2 && (
          <fieldset>
            <legend className="text-2xl font-bold text-slate-900">Anything about your background?</legend>
            <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-slate-600">Optional. Pick up to 3 so we can find students like you.</p>
              <p className="text-sm font-semibold tabular-nums text-slate-500" aria-live="polite">
                {background.length}/{MAX_BACKGROUND} selected
              </p>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {options.background.map((o) => {
                const selected = background.includes(o.id);
                return (
                  <Chip
                    key={o.id}
                    label={o.label}
                    selected={selected}
                    disabled={!selected && background.length >= MAX_BACKGROUND}
                    onToggle={() => setBackground((l) => toggle(l, o.id, MAX_BACKGROUND))}
                  />
                );
              })}
            </div>
          </fieldset>
        )}

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
          <button
            type="button"
            onClick={() => setStep(step - 1)}
            disabled={step === 0}
            className={`${btnSecondary} ${step === 0 ? "invisible" : ""}`}
          >
            <IconArrowLeft />
            Back
          </button>
          <div className="flex gap-2">
            {step === 2 && (
              <button
                type="button"
                onClick={() => submit([])}
                disabled={submitting}
                className="rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100"
              >
                Skip
              </button>
            )}
            <button type="submit" disabled={!canNext || submitting} className={btnPrimary}>
              {step === 2 ? (submitting ? "Building plan…" : "Build my plan") : "Next"}
              <IconArrowRight />
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
