import type { OptionsResponse } from "@/contract/types";
import { getDb } from "@/lib/data";

export async function GET() {
  const db = getDb();
  const body: OptionsResponse = {
    interests: db.taxonomy.interests,
    background: db.taxonomy.background,
    goals: db.taxonomy.goals.map(({ id, label }) => ({ id, label })),
    pathways: db.pathways.map((p) => ({
      id: p.id,
      label: p.major,
      degree: p.degree,
      college: p.college,
      description: p.description,
    })),
    mentorTopics: db.taxonomy.mentorTopics,
    syntheticNote: db.syntheticNote,
  };
  return Response.json(body);
}
