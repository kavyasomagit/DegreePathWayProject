import type {
  AdvisorResponse,
  AiErrorCode,
  MentorsResponse,
  OptionsResponse,
  ProfileRequest,
  ProfileResponse,
  QuestionnaireAnswers,
  RecommendationResponse,
} from "@/contract/types";

const AI_CODES: readonly AiErrorCode[] = ["not_configured", "invalid_key", "no_quota", "rate_limited", "timeout", "failed"];

/** Error from an API call. `code` is set when the server returned an AiError. */
export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: AiErrorCode | null;
  constructor(message: string, status: number, code: AiErrorCode | null) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
  }
}

/** AiErrorCode for any thrown value (network errors and unknown failures map to "failed"). */
export function aiErrorCode(e: unknown): AiErrorCode {
  return e instanceof ApiRequestError && e.code ? e.code : "failed";
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (!res.ok) {
    const obj = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
    const message = obj && "error" in obj ? String(obj.error) : `Request failed (${res.status})`;
    const code =
      obj && typeof obj.code === "string" && (AI_CODES as readonly string[]).includes(obj.code)
        ? (obj.code as AiErrorCode)
        : null;
    throw new ApiRequestError(message, res.status, code);
  }
  return body as T;
}

function postJson<T>(url: string, body: unknown, signal?: AbortSignal): Promise<T> {
  return request<T>(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
}

export function getOptions(signal?: AbortSignal): Promise<OptionsResponse> {
  return request<OptionsResponse>("/api/options", { signal });
}

export function getRecommendations(
  answers: QuestionnaireAnswers,
  signal?: AbortSignal,
): Promise<RecommendationResponse> {
  return postJson<RecommendationResponse>("/api/recommendations", answers, signal);
}

export function getAiStatus(signal?: AbortSignal): Promise<{ enabled: boolean }> {
  return request<{ enabled: boolean }>("/api/ai-status", { signal });
}

export function parseProfile(body: ProfileRequest, signal?: AbortSignal): Promise<ProfileResponse> {
  return postJson<ProfileResponse>("/api/profile", body, signal);
}

export function getAdvisor(answers: QuestionnaireAnswers, signal?: AbortSignal): Promise<AdvisorResponse> {
  return postJson<AdvisorResponse>("/api/advisor", answers, signal);
}

export interface MentorQuery {
  goal?: string;
  pathwayId?: string;
  topic?: string;
  mentorsOnly?: boolean;
  interests?: string[];
  background?: string[];
  limit?: number;
}

export function buildMentorQuery(q: MentorQuery): string {
  const params = new URLSearchParams();
  if (q.goal) params.set("goal", q.goal);
  if (q.pathwayId) params.set("pathwayId", q.pathwayId);
  if (q.topic) params.set("topic", q.topic);
  if (q.mentorsOnly) params.set("mentorsOnly", "true");
  if (q.interests?.length) params.set("interests", q.interests.join(","));
  if (q.background?.length) params.set("background", q.background.join(","));
  if (q.limit) params.set("limit", String(q.limit));
  return params.toString();
}

export function getMentors(query: string, signal?: AbortSignal): Promise<MentorsResponse> {
  return request<MentorsResponse>(`/api/mentors${query ? `?${query}` : ""}`, { signal });
}
