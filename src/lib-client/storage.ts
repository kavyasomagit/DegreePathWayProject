import type { AdvisorResponse, QuestionnaireAnswers, RecommendationResponse } from "@/contract/types";

export const ANSWERS_KEY = "dps:answers";
export const RESULT_KEY = "dps:result";
export const ADVISOR_KEY = "dps:advisor";
const CHANGE_EVENT = "dps-storage";

/** Cached result, tagged with the request it answers so stale results are never shown. */
export interface CachedResult {
  key: string;
  response: RecommendationResponse;
}

/** Cached AI advisor response, keyed by answersKey like the result cache. */
export interface CachedAdvisor {
  key: string;
  response: AdvisorResponse;
}

export function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function readRaw(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: unknown | null): void {
  try {
    if (value === null) window.sessionStorage.removeItem(key);
    else window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full or unavailable: the app still works without caching
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function subscribe(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  window.addEventListener(CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

export function parseAnswers(raw: string | null): QuestionnaireAnswers | null {
  const v = safeParse<Record<string, unknown>>(raw);
  if (!v || typeof v.goal !== "string" || !isStringArray(v.interests)) return null;
  return {
    goal: v.goal,
    interests: v.interests,
    background: isStringArray(v.background) ? v.background : [],
    ...(typeof v.pathwayId === "string" && v.pathwayId ? { pathwayId: v.pathwayId } : {}),
    ...(typeof v.about === "string" && v.about.trim() ? { about: v.about } : {}),
  };
}

export function parseAdvisor(raw: string | null): CachedAdvisor | null {
  const v = safeParse<CachedAdvisor>(raw);
  if (!v || typeof v.key !== "string" || !v.response || typeof v.response.summary !== "string") return null;
  if (!Array.isArray(v.response.termTips)) return null;
  return v;
}

export function parseResult(raw: string | null): CachedResult | null {
  const v = safeParse<CachedResult>(raw);
  if (!v || typeof v.key !== "string" || !v.response || !v.response.major) return null;
  return v;
}

/** Stable identity for a set of answers (order-insensitive). */
export function answersKey(a: QuestionnaireAnswers): string {
  return JSON.stringify({
    goal: a.goal,
    interests: [...a.interests].sort(),
    background: [...a.background].sort(),
    pathwayId: a.pathwayId ?? null,
    about: a.about?.trim() || null,
  });
}

export function saveAdvisor(key: string, response: AdvisorResponse): void {
  write(ADVISOR_KEY, { key, response } satisfies CachedAdvisor);
}

export function saveAnswers(answers: QuestionnaireAnswers): void {
  write(ANSWERS_KEY, answers);
}

export function saveResult(key: string, response: RecommendationResponse): void {
  write(RESULT_KEY, { key, response } satisfies CachedResult);
}

export function clearResult(): void {
  write(RESULT_KEY, null);
}
