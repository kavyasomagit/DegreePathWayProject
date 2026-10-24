"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { MentorsResponse, Option } from "@/contract/types";
import { buildMentorQuery, getMentors, getOptions } from "@/lib-client/api";
import { useHydrated, useStoredRaw } from "@/lib-client/hooks";
import { ANSWERS_KEY, RESULT_KEY, parseAnswers, parseResult } from "@/lib-client/storage";
import { MentorCard } from "@/components/MentorCard";
import { ErrorState, Skeleton, btnPrimary } from "@/components/ui";

type Fetched = { key: string; data: MentorsResponse } | { key: string; error: string };

export function MentorsView() {
  const hydrated = useHydrated();
  const answersRaw = useStoredRaw(ANSWERS_KEY);
  const resultRaw = useStoredRaw(RESULT_KEY);
  const answers = useMemo(() => parseAnswers(answersRaw), [answersRaw]);
  const cached = useMemo(() => parseResult(resultRaw), [resultRaw]);
  const pathwayId = answers ? (cached?.response.major.pathwayId ?? answers.pathwayId) : undefined;

  const [mentorsOnly, setMentorsOnly] = useState(false);
  const [topic, setTopic] = useState("");
  const [topics, setTopics] = useState<Option[]>([]);
  const [fetched, setFetched] = useState<Fetched | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    getOptions(ctrl.signal)
      .then((o) => setTopics(o.mentorTopics))
      .catch(() => {
        // topic filter is optional; leave it empty if options fail
      });
    return () => ctrl.abort();
  }, []);

  const query = buildMentorQuery({
    goal: answers?.goal,
    pathwayId,
    interests: answers?.interests,
    background: answers?.background,
    topic: topic || undefined,
    mentorsOnly,
    limit: 24,
  });
  const requestKey = `${query}#${attempt}`;

  useEffect(() => {
    if (!hydrated) return;
    const ctrl = new AbortController();
    getMentors(query, ctrl.signal)
      .then((data) => setFetched({ key: requestKey, data }))
      .catch((e: unknown) => {
        if (!ctrl.signal.aborted)
          setFetched({ key: requestKey, error: e instanceof Error ? e.message : "Could not load mentors." });
      });
    return () => ctrl.abort();
  }, [hydrated, query, requestKey]);

  const current = fetched && fetched.key === requestKey ? fetched : null;
  const loading = !current;
  const goalLabel = cached?.response.goalLabel;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Mentors</h1>
        <p className="text-slate-600">
          {!answers
            ? "Browse alumni and seniors who have offered to share advice."
            : cached && goalLabel
              ? `Alumni and seniors ranked by how closely their path matches yours: ${goalLabel}, ${cached.response.major.major} major.`
              : "Alumni and seniors ranked by how closely their path matches yours."}
        </p>
      </div>

      {hydrated && !answers && (
        <div className="flex flex-col gap-3 rounded-xl border border-indigo-200 bg-indigo-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-indigo-900">
            Take the questionnaire to see mentors matched to your goal, interests and background.
          </p>
          <Link href="/questionnaire" className={`${btnPrimary} shrink-0`}>
            Take the questionnaire
          </Link>
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:gap-6">
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            role="switch"
            checked={mentorsOnly}
            onChange={(e) => setMentorsOnly(e.target.checked)}
            className="h-4 w-4 accent-indigo-600"
          />
          Mentors only
        </label>
        <div className="flex items-center gap-2">
          <label htmlFor="topic" className="text-sm font-medium text-slate-700">
            Topic
          </label>
          <select
            id="topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm sm:flex-none"
          >
            <option value="">Any topic</option>
            {topics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        {current && "data" in current && (
          <p className="text-sm text-slate-500 sm:ml-auto" aria-live="polite">
            Showing {current.data.mentors.length} of {current.data.total}
          </p>
        )}
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Loading mentors">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-72" />
          ))}
        </div>
      ) : "error" in current ? (
        <ErrorState message={current.error} onRetry={() => setAttempt((a) => a + 1)} />
      ) : current.data.mentors.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-600">
          No mentors match these filters. Try another topic or turn off &ldquo;Mentors only&rdquo;.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {current.data.mentors.map((m) => (
            <MentorCard key={m.id} mentor={m} />
          ))}
        </div>
      )}

      <p className="text-xs text-slate-500">
        Contact details are fake (example.com / linkedin.example.com) because this is synthetic data.
      </p>
    </div>
  );
}
