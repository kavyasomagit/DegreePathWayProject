/**
 * Minimal server-side OpenAI client (Chat Completions + Structured Outputs), no SDK dependency.
 * The API key is read from process.env.OPENAI_API_KEY and never leaves the server.
 *
 * Model selection: OPENAI_MODEL if set, otherwise the first model in FALLBACK_MODELS that the key can use.
 */
import type { AiErrorCode } from "@/contract/types";

const FALLBACK_MODELS = ["gpt-5-mini", "gpt-4.1-mini", "gpt-4o-mini"];
const TIMEOUT_MS = 25_000;

export class LlmError extends Error {
  constructor(
    public code: AiErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export function llmConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

function candidateModels(): string[] {
  const configured = process.env.OPENAI_MODEL?.trim();
  return configured ? [configured, ...FALLBACK_MODELS.filter((m) => m !== configured)] : FALLBACK_MODELS;
}

/** Remember the first model that worked so later calls skip the ones that 404. */
let workingModel: string | null = null;

interface ChatJsonOptions {
  system: string;
  user: string;
  schemaName: string;
  schema: Record<string, unknown>;
  maxTokens?: number;
}

export async function chatJson<T>(opts: ChatJsonOptions): Promise<{ data: T; model: string }> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new LlmError("not_configured", "OPENAI_API_KEY is not set on the server.");

  const models = workingModel ? [workingModel] : candidateModels();
  let lastError: LlmError | null = null;

  for (const model of models) {
    // Reasoning models (gpt-5*, o*) accept reasoning_effort; others reject it, so we retry without.
    const tryReasoning = /^(gpt-5|o\d)/.test(model);
    for (const withReasoning of tryReasoning ? [true, false] : [false]) {
      const body: Record<string, unknown> = {
        model,
        messages: [
          { role: "system", content: opts.system },
          { role: "user", content: opts.user },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: opts.schemaName, strict: true, schema: opts.schema },
        },
        max_completion_tokens: opts.maxTokens ?? 1500,
      };
      if (withReasoning) body.reasoning_effort = "low";

      let res: Response;
      try {
        res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
      } catch (e) {
        const timedOut = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
        throw new LlmError(timedOut ? "timeout" : "failed", timedOut ? "OpenAI did not respond in time." : "Could not reach OpenAI.");
      }

      const json = (await res.json().catch(() => ({}))) as {
        error?: { code?: string; type?: string; message?: string; param?: string };
        choices?: { message?: { content?: string | null; refusal?: string | null }; finish_reason?: string }[];
      };

      if (res.ok) {
        const msg = json.choices?.[0]?.message;
        if (msg?.refusal) throw new LlmError("failed", "The model declined to answer.");
        try {
          const data = JSON.parse(msg?.content ?? "") as T;
          workingModel = model;
          return { data, model };
        } catch {
          throw new LlmError("failed", "The model returned an incomplete answer.");
        }
      }

      const code = json.error?.code ?? json.error?.type ?? "";
      if (res.status === 401) throw new LlmError("invalid_key", "OpenAI rejected the API key.");
      if (res.status === 429) {
        throw new LlmError(
          code === "insufficient_quota" ? "no_quota" : "rate_limited",
          code === "insufficient_quota" ? "The OpenAI account has no remaining quota." : "OpenAI rate limit reached.",
        );
      }
      if (res.status === 400 && withReasoning && /reasoning/i.test(`${json.error?.param} ${json.error?.message}`)) {
        continue; // retry same model without reasoning_effort
      }
      if (res.status === 404 || code === "model_not_found" || /model/i.test(json.error?.param ?? "")) {
        lastError = new LlmError("failed", `Model ${model} is not available for this key.`);
        break; // try next model
      }
      throw new LlmError("failed", `OpenAI error ${res.status}: ${json.error?.message?.slice(0, 160) ?? "unknown"}`);
    }
  }
  throw lastError ?? new LlmError("failed", "No usable OpenAI model found.");
}
