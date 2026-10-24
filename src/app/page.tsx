import Link from "next/link";
import { IconArrowRight } from "@/components/Icons";
import { btnPrimary } from "@/components/ui";

const steps = [
  {
    title: "Tell us about you",
    body: "Choose your career goal, what you're curious about, and a bit of background. It takes about a minute.",
  },
  {
    title: "See a term-by-term plan with evidence",
    body: "Get a recommended major, minor and 8-semester course plan. Every pick shows how many similar students made it.",
  },
  {
    title: "Talk to real alumni mentors",
    body: "Connect with alumni and seniors who already walked the path you're considering.",
  },
];

export default function Home() {
  return (
    <div className="space-y-14">
      <section className="mx-auto max-w-3xl pt-4 text-center sm:pt-10">
        <p className="text-sm font-semibold uppercase tracking-wider text-indigo-600">Ridgeview State University</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          Plan your degree with the people who came before you
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-slate-600">
          Pick your courses, major and minor by learning from students who came before you. We match your goals and
          interests to alumni with similar profiles, then turn what they actually took into a semester-by-semester plan,
          with the evidence behind every recommendation.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/questionnaire" className={`${btnPrimary} px-6 py-3 text-base`}>
            Build my plan
            <IconArrowRight />
          </Link>
          <Link href="/mentors" className="rounded-md px-3 py-2 text-sm font-semibold text-indigo-700 hover:underline">
            Browse mentors
          </Link>
        </div>
      </section>

      <section aria-labelledby="how-it-works">
        <h2 id="how-it-works" className="text-center text-2xl font-bold text-slate-900">
          How it works
        </h2>
        <ol className="mt-6 grid gap-4 md:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.title} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-indigo-600 font-semibold text-white">
                {i + 1}
              </span>
              <h3 className="mt-4 font-semibold text-slate-900">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <p className="mx-auto max-w-2xl rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-900">
        This is a demo with synthetic data. Every student, alumnus, course, employer and outcome is fictional.
      </p>
    </div>
  );
}
