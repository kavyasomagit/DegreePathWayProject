import type { AiError } from "@/contract/types";
import { adviseOnPlan } from "@/lib/ai";
import { LlmError } from "@/lib/llm";
import { InputError, normalizeAnswers, recommend } from "@/lib/recommend";

/**
 * POST /api/advisor  body: QuestionnaireAnswers
 * Recomputes the plan on the server (so the model only ever sees our own data), then asks OpenAI to explain it.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  try {
    const answers = normalizeAnswers(body);
    return Response.json(await adviseOnPlan(answers, recommend(answers)));
  } catch (e) {
    if (e instanceof InputError) return Response.json({ error: e.message, code: "failed" } satisfies AiError, { status: 400 });
    if (e instanceof LlmError) {
      console.error(`[advisor] ${e.code}: ${e.message}`);
      return Response.json({ error: e.message, code: e.code } satisfies AiError, { status: 503 });
    }
    console.error(e);
    return Response.json({ error: "The AI advisor is unavailable right now.", code: "failed" } satisfies AiError, { status: 500 });
  }
}
