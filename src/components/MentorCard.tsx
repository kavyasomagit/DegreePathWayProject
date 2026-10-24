import type { Mentor } from "@/contract/types";
import { IconBriefcase, IconCap, IconLink, IconMail, IconMapPin } from "./Icons";

const EMAIL_SUBJECT = encodeURIComponent("Advice from a Ridgeview student");

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function MentorCard({ mentor }: { mentor: Mentor }) {
  const m = mentor;
  return (
    <article className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700"
          aria-hidden="true"
        >
          {initials(m.name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold leading-tight text-slate-900">{m.name}</h3>
            <span
              className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold tabular-nums text-emerald-800"
              title="Match score"
            >
              {m.matchScore}% match
            </span>
          </div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
              {m.type === "alumni" ? `Alumni · Class of ${m.gradYear}` : "Senior"}
            </span>
            {m.isMentor && (
              <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-xs font-medium text-white">Mentor</span>
            )}
          </div>
        </div>
      </div>

      <ul className="mt-3 space-y-1 text-sm text-slate-600">
        <li className="flex gap-2">
          <IconCap className="mt-0.5 shrink-0 text-slate-400" />
          <span>
            {m.major}
            {m.minor ? ` · Minor in ${m.minor}` : ""}
          </span>
        </li>
        {(m.jobTitle || m.employer) && (
          <li className="flex gap-2">
            <IconBriefcase className="mt-0.5 shrink-0 text-slate-400" />
            <span>
              {m.jobTitle ?? "Works"}
              {m.employer ? ` @ ${m.employer}` : ""}
            </span>
          </li>
        )}
        {m.type === "senior" && !m.jobTitle && (
          <li className="flex gap-2">
            <IconBriefcase className="mt-0.5 shrink-0 text-slate-400" />
            <span>Aiming for {m.goalLabel}</span>
          </li>
        )}
        {m.city && (
          <li className="flex gap-2">
            <IconMapPin className="mt-0.5 shrink-0 text-slate-400" />
            <span>{m.city}</span>
          </li>
        )}
        {m.gradSchool && (
          <li className="flex gap-2">
            <IconCap className="mt-0.5 shrink-0 text-slate-400" />
            <span>Grad school: {m.gradSchool}</span>
          </li>
        )}
      </ul>

      {m.matchReasons.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Why this match">
          {m.matchReasons.map((r) => (
            <li key={r} className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800 ring-1 ring-emerald-200">
              {r}
            </li>
          ))}
        </ul>
      )}

      {m.isMentor && (
        <div className="mt-3 rounded-lg bg-indigo-50 p-2.5">
          <p className="text-xs font-medium text-indigo-900">Accepts up to {m.maxMentees} mentees</p>
          {m.mentorTopics.length > 0 && (
            <ul className="mt-1.5 flex flex-wrap gap-1" aria-label="Mentoring topics">
              {m.mentorTopics.map((t) => (
                <li key={t.id} className="rounded-full bg-white px-2 py-0.5 text-xs text-indigo-700 ring-1 ring-indigo-200">
                  {t.label}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="mt-auto flex gap-2 pt-4">
        {m.linkedinUrl && (
          <a
            href={m.linkedinUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <IconLink />
            LinkedIn
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        )}
        {m.email && (
          <a
            href={`mailto:${m.email}?subject=${EMAIL_SUBJECT}`}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <IconMail />
            Email
          </a>
        )}
      </div>
    </article>
  );
}
