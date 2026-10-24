import type { AiError } from "@/contract/types";
import { ABOUT_MAX_CHARS, parseProfile } from "@/lib/ai";
import { LlmError } from "@/lib/llm";

/** POST /api/profile { text, goal? } -> tags extracted from the student's free text by OpenAI. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { text?: unknown; goal?: unknown } | null;
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text) return Response.json({ error: "Please write a few words about yourself.", code: "failed" } satisfies AiError, { status: 400 });
  if (text.length > ABOUT_MAX_CHARS)
    return Response.json({ error: `Please keep it under ${ABOUT_MAX_CHARS} characters.`, code: "failed" } satisfies AiError, { status: 400 });
  try {
    return Response.json(await parseProfile(text, { goal: typeof body?.goal === "string" ? body.goal : undefined }));
  } catch (e) {
    if (e instanceof LlmError) {
      console.error(`[profile] ${e.code}: ${e.message}`);
      return Response.json({ error: e.message, code: e.code } satisfies AiError, { status: 503 });
    }
    console.error(e);
    return Response.json({ error: "Could not read your description.", code: "failed" } satisfies AiError, { status: 500 });
  }
}
