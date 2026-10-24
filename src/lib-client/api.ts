import type {
  MentorsResponse,
  OptionsResponse,
  QuestionnaireAnswers,
  RecommendationResponse,
} from "@/contract/types";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (!res.ok) {
    const message =
      body && typeof body === "object" && "error" in body
        ? String((body as { error: unknown }).error)
        : `Request failed (${res.status})`;
    throw new Error(message);
  }
  return body as T;
}

export function getOptions(signal?: AbortSignal): Promise<OptionsResponse> {
  return request<OptionsResponse>("/api/options", { signal });
}

export function getRecommendations(
  answers: QuestionnaireAnswers,
  signal?: AbortSignal,
): Promise<RecommendationResponse> {
  return request<RecommendationResponse>("/api/recommendations", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(answers),
    signal,
  });
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
