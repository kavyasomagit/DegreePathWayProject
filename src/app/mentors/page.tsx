import type { Metadata } from "next";
import { MentorsView } from "./MentorsView";

export const metadata: Metadata = { title: "Mentors · Degree Pathway Suggester" };

export default function MentorsPage() {
  return <MentorsView />;
}
