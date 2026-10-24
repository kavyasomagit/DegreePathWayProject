import type { MentorsResponse } from "@/contract/types";
import { getDb } from "@/lib/data";
import { listMentors } from "@/lib/recommend";

/** GET /api/mentors?goal=&pathwayId=&topic=&mentorsOnly=true&interests=a,b&background=x,y&limit=24 */
export async function GET(request: Request) {
  const db = getDb();
  const q = new URL(request.url).searchParams;
  const list = (k: string) => (q.get(k) ?? "").split(",").filter(Boolean);
  const valid = (v: string | null, m: Map<string, unknown>) => (v && m.has(v) ? v : undefined);
  const limit = Math.min(100, Math.max(1, Number(q.get("limit")) || 24));

  const { mentors, total } = listMentors({
    goal: valid(q.get("goal"), db.goalById),
    pathwayId: valid(q.get("pathwayId"), db.pathwayById),
    topic: valid(q.get("topic"), db.topicById),
    mentorsOnly: q.get("mentorsOnly") === "true",
    interests: list("interests").filter((i) => db.interestById.has(i)),
    background: list("background").filter((b) => db.backgroundById.has(b)),
    limit,
  });
  const body: MentorsResponse = { mentors, total, syntheticNote: db.syntheticNote };
  return Response.json(body);
}
