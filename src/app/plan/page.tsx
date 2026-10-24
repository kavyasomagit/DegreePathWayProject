import type { Metadata } from "next";
import { PlanView } from "./PlanView";

export const metadata: Metadata = { title: "My plan · Degree Pathway Suggester" };

export default function PlanPage() {
  return <PlanView />;
}
