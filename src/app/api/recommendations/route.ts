import type { ApiError } from "@/contract/types";
import { InputError, normalizeAnswers, recommend } from "@/lib/recommend";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." } satisfies ApiError, { status: 400 });
  }
  try {
    return Response.json(recommend(normalizeAnswers(body)));
  } catch (e) {
    if (e instanceof InputError) return Response.json({ error: e.message } satisfies ApiError, { status: 400 });
    console.error(e);
    return Response.json({ error: "Something went wrong building your plan." } satisfies ApiError, { status: 500 });
  }
}
