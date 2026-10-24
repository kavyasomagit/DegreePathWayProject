import { connection } from "next/server";
import { llmConfigured } from "@/lib/llm";

/** GET /api/ai-status -> { enabled } so the UI can hide AI features when no key is configured. */
export async function GET() {
  await connection(); // evaluate at request time, not at build time
  return Response.json({ enabled: llmConfigured() });
}
