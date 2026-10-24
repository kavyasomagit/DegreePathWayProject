"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Option, OptionsResponse, ProfileResponse, QuestionnaireAnswers } from "@/contract/types";
import { ApiRequestError, aiErrorCode, getOptions, parseProfile } from "@/lib-client/api";
import { useAiEnabled, useHydrated, useStoredRaw } from "@/lib-client/hooks";
import { ANSWERS_KEY, clearResult, parseAnswers, saveAnswers } from "@/lib-client/storage";
import { Chip } from "@/components/Chip";
import { StepIndicator } from "@/components/StepIndicator";
import { IconAlert, IconArrowLeft, IconArrowRight, IconCheck, IconSearch, IconSparkle } from "@/components/Icons";
import { AiBadge, aiErrorMessage } from "@/components/ai";
import { ErrorState, Skeleton, btnPrimary, btnSecondary } from "@/components/ui";

const STEPS = ["Goal", "Interests", "Background", "About you"];
const MAX_INTERESTS = 4;
const MAX_BACKGROUND = 3;
/** caps after merging AI-detected tags (match the server's limits) */
const MAX_MERGED_INTERESTS = 6;
const MAX_MERGED_BACKGROUND = 10;
const MAX_ABOUT = 1000;

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

  // Step 4: free text + optional AI analysis
  const aiEnabled = useAiEnabled();
  const [about, setAbout] = useState(initial?.about ?? "");
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [excluded, setExcluded] = useState<Set<string>>(() => new Set());
  const [analyzing, setAnalyzing] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const analyzeRun = useRef(0);

  const filteredGoals = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.goals.filter((g) => g.label.toLowerCase().includes(q)) : options.goals;
  }, [options.goals, query]);

  const toggle = (list: string[], id: string, max: number) =>
    list.includes(id) ? list.filter((x) => x !== id) : list.length < max ? [...list, id] : list;

  const canNext = step === 0 ? goal !== "" : step === 1 ? interests.length >= 1 : true;

  /** Submit. `useAbout` = include the step-4 text and still-selected AI-detected tags (false for "Skip"). */
  function submit(useAbout: boolean) {
    setSubmitting(true);
    const kept = (list: Option[] | undefined) =>
      useAbout && list ? list.map((o) => o.id).filter((id) => !excluded.has(id)) : [];
    const union = (a: string[], b: string[], max: number) => [...new Set([...a, ...b])].slice(0, max);
    const text = about.trim().slice(0, MAX_ABOUT);
    const answers: QuestionnaireAnswers = {
      goal,
      interests: union(interests, kept(profile?.interests), MAX_MERGED_INTERESTS),
      background: union(background, kept(profile?.background), MAX_MERGED_BACKGROUND),
    };
    if (useAbout && text) answers.about = text;
    saveAnswers(answers);
    clearResult();
    router.push("/plan");
  }

  async function analyze() {
    const text = about.trim();
    if (!text || analyzing) return;
    const run = ++analyzeRun.current;
    setAnalyzing(true);
    setAiError(null);
    try {
      const res = await parseProfile({ text, goal: goal || undefined });
      if (run !== analyzeRun.current) return;
      setProfile(res);
      setExcluded(new Set());
    } catch (e: unknown) {
      if (run !== analyzeRun.current) return;
      // 400s carry a specific validation message (empty / too long); everything else gets a friendly message
      setAiError(
        e instanceof ApiRequestError && e.status === 400 ? e.message : aiErrorMessage(aiErrorCode(e)),
      );
    } finally {
      if (run === analyzeRun.current) setAnalyzing(false);
    }
  }

  const toggleDetected = (id: string) =>
    setExcluded((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const suggestedGoal =
    profile?.suggestedGoal && profile.suggestedGoal.id !== goal && options.goals.some((g) => g.id === profile.suggestedGoal?.id)
      ? profile.suggestedGoal
      : null;
  const lastStep = STEPS.length - 1;

  return (
    <div className="mx-auto max-w-3xl">
      <StepIndicator steps={STEPS} current={step} />

      <form
        className="mt-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8"
        onSubmit={(e) => {
          e.preventDefault();
          if (!canNext) return;
          if (step < lastStep) setStep(step + 1);
          else submit(true);
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

        {step === 3 && (
          <fieldset>
            <legend className="text-2xl font-bold text-slate-900">Tell us more about yourself (optional)</legend>
            <p className="mt-1 text-slate-600">
              A few sentences help personalize your plan. You can skip this step.
            </p>
            <label htmlFor="about" className="sr-only">
              About you
            </label>
            <textarea
              id="about"
              value={about}
              maxLength={MAX_ABOUT}
              rows={5}
              onChange={(e) => setAbout(e.target.value.slice(0, MAX_ABOUT))}
              placeholder="Hobbies, favorite classes, jobs or projects, what you're unsure about…"
              aria-describedby="about-count about-privacy"
              className="mt-5 w-full resize-y rounded-lg border border-slate-300 px-3 py-2.5 text-sm placeholder:text-slate-400 focus:border-indigo-500"
            />
            <div className="mt-1 flex flex-wrap items-start justify-between gap-2">
              <p id="about-privacy" className="max-w-lg text-xs text-slate-500">
                Your text is sent to OpenAI to personalize your plan. Don&apos;t include sensitive details like ID
                numbers or health information.
              </p>
              <p
                id="about-count"
                className={`text-xs font-semibold tabular-nums ${about.length >= MAX_ABOUT ? "text-amber-700" : "text-slate-500"}`}
                aria-live="polite"
              >
                {about.length}/{MAX_ABOUT}
              </p>
            </div>

            {aiEnabled && (
              <button
                type="button"
                onClick={analyze}
                disabled={analyzing || about.trim() === ""}
                className={`${btnSecondary} mt-4 border-fuchsia-300 text-fuchsia-800 hover:bg-fuchsia-50`}
              >
                <IconSparkle className={analyzing ? "animate-pulse" : ""} />
                {analyzing ? "Analyzing…" : "Analyze with AI"}
              </button>
            )}

            {aiError && (
              <p role="alert" className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                <IconAlert className="mt-0.5 shrink-0" />
                {aiError}
              </p>
            )}

            {profile && (
              <div className="mt-5 rounded-lg border border-fuchsia-200 bg-fuchsia-50/50 p-4" aria-live="polite">
                <div className="flex items-start gap-2">
                  <AiBadge className="mt-0.5 shrink-0" />
                  <p className="text-sm text-slate-800">{profile.summary}</p>
                </div>
                {profile.interests.length + profile.background.length > 0 ? (
                  <>
                    <p className="mt-4 text-sm font-semibold text-slate-900">We picked up:</p>
                    <p className="text-xs text-slate-500">Tap a tag to leave it out.</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {[
                        ...profile.interests.map((o) => ({ o, chosen: interests.includes(o.id) })),
                        ...profile.background.map((o) => ({ o, chosen: background.includes(o.id) })),
                      ].map(({ o, chosen }) =>
                        chosen ? (
                          <span
                            key={o.id}
                            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-500"
                          >
                            <IconCheck width={14} height={14} />
                            {o.label}
                            <span className="text-xs">(already selected)</span>
                          </span>
                        ) : (
                          <Chip
                            key={o.id}
                            label={o.label}
                            selected={!excluded.has(o.id)}
                            onToggle={() => toggleDetected(o.id)}
                          />
                        ),
                      )}
                    </div>
                  </>
                ) : (
                  <p className="mt-3 text-sm text-slate-600">No extra interests or background tags found.</p>
                )}
                {suggestedGoal && (
                  <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg bg-white p-3 ring-1 ring-fuchsia-200">
                    <p className="text-sm text-slate-800">
                      Your description sounds like <strong>{suggestedGoal.label}</strong>. Switch my goal?
                    </p>
                    <button
                      type="button"
                      onClick={() => setGoal(suggestedGoal.id)}
                      className="rounded-lg bg-fuchsia-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-fuchsia-800"
                    >
                      Switch to {suggestedGoal.label}
                    </button>
                  </div>
                )}
                {profile.suggestedGoal && profile.suggestedGoal.id === goal && (
                  <p className="mt-4 flex items-center gap-1.5 text-sm text-emerald-800">
                    <IconCheck /> Goal set to {profile.suggestedGoal.label}.
                  </p>
                )}
              </div>
            )}
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
            {(step === 2 || step === 3) && (
              <button
                type="button"
                onClick={() => {
                  if (step === 2) {
                    setBackground([]);
                    setStep(3);
                  } else submit(false);
                }}
                disabled={submitting}
                className="rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100"
              >
                Skip
              </button>
            )}
            <button type="submit" disabled={!canNext || submitting || analyzing} className={btnPrimary}>
              {step === lastStep ? (submitting ? "Building plan…" : "See my plan") : "Next"}
              <IconArrowRight />
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
