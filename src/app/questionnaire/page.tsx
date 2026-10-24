import type { Metadata } from "next";
import { Questionnaire } from "./Questionnaire";

export const metadata: Metadata = { title: "Questionnaire · Degree Pathway Suggester" };

export default function QuestionnairePage() {
  return <Questionnaire />;
}
