/**
 * Matching + recommendation engine (server only).
 *
 * 1. Similarity of the new student to every past student:
 *      0.5 * same goal + 0.3 * Jaccard(interests) + 0.2 * Jaccard(background)
 * 2. Evidence cohort = up to 30 ALUMNI who reached the student's goal, most similar first.
 * 3. Major = pathway with the largest similarity-weighted share of the cohort,
 *    nudged by how well the pathway matches the student's interests.
 * 4. Minor = most common minor among cohort members in that major.
 * 5. Plan = gen-ed + major core + popular electives + minor + "goal signal" courses
 *    (taken by the cohort far more often than by alumni overall), closed under prereqs,
 *    then scheduled into 8 terms at the term similar students usually took them,
 *    respecting prereqs (strictly earlier term), season offered and an 18-credit cap.
 * Every item carries an Evidence object with counts so the UI can explain it.
 */
import type {
  ClubRecommendation,
  CourseReason,
  Evidence,
  MajorRecommendation,
  Mentor,
  MinorRecommendation,
  PlanCourse,
  PlanTerm,
  QuestionnaireAnswers,
  RecommendationResponse,
  Season,
  SimilarSummary,
} from "@/contract/types";
import { getDb, type Course, type Db, type Pathway, type Person } from "./data";

const W_GOAL = 0.5;
const W_INTERESTS = 0.3;
const W_BACKGROUND = 0.2;
const COHORT_MAX = 30;
const TERMS = 8;
const MAX_CREDITS = 18;
const MIN_CREDITS = 12;
const GOAL_SIGNAL_MAX = 4;
const MENTOR_LIMIT = 12;

export class InputError extends Error {}

interface Scored {
  p: Person;
  s: number;
}

// ---------------------------------------------------------------- helpers
export function jaccard(a: string[], b: string[]): number {
  const A = new Set(a);
  const B = new Set(b);
  if (A.size === 0 && B.size === 0) return 0;
  let inter = 0;
  for (const x of B) if (A.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}

export function similarity(ans: Pick<QuestionnaireAnswers, "goal" | "interests" | "background">, p: Person): number {
  return (
    W_GOAL * (ans.goal && p.goal === ans.goal ? 1 : 0) +
    W_INTERESTS * jaccard(ans.interests, p.interests) +
    W_BACKGROUND * jaccard(ans.background, p.background)
  );
}

const seasonOf = (t: number): Season => (t % 2 === 1 ? "Fall" : "Spring");
const termLabel = (t: number) => `Year ${Math.ceil(t / 2)} · ${seasonOf(t)}`;
const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : Math.ceil((s[m - 1] + s[m]) / 2);
};
const pct = (x: number) => Math.round(x * 100);
const byIdThenScore = (a: Scored, b: Scored) => b.s - a.s || (a.p.id < b.p.id ? -1 : 1);
const goalNoun = (label: string) => label.replace(/\s*\(.*\)\s*/, "").trim();
const withArticle = (noun: string) => `${/^[aeiou]/i.test(noun) ? "an" : "a"} ${noun}`;

function topCounts(values: string[], n: number) {
  const m = new Map<string, number>();
  for (const v of values) m.set(v, (m.get(v) ?? 0) + 1);
  return [...m.entries()]
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .slice(0, n)
    .map(([label, count]) => ({ label, count }));
}

/** Map a pathway to the minor id that would duplicate it. */
const OWN_MINOR: Record<string, string> = {
  computer_science: "computer_science",
  economics: "economics",
  psychology: "psychology",
  biology_premed: "biology",
  graphic_design: "design",
};

// ---------------------------------------------------------------- input validation
export function normalizeAnswers(body: unknown): QuestionnaireAnswers {
  const db = getDb();
  if (!body || typeof body !== "object") throw new InputError("Request body must be a JSON object.");
  const b = body as Record<string, unknown>;
  const goal = typeof b.goal === "string" ? b.goal : "";
  if (!db.goalById.has(goal)) throw new InputError("Missing or unknown 'goal'. Use an id from GET /api/options.");
  const pick = (v: unknown, valid: Map<string, unknown>, max: number) =>
    Array.isArray(v)
      ? [...new Set(v.filter((x): x is string => typeof x === "string" && valid.has(x)))].slice(0, max)
      : [];
  const answers: QuestionnaireAnswers = {
    goal,
    interests: pick(b.interests, db.interestById, 6),
    background: pick(b.background, db.backgroundById, 10),
  };
  if (typeof b.pathwayId === "string" && db.pathwayById.has(b.pathwayId)) answers.pathwayId = b.pathwayId;
  if (typeof b.about === "string" && b.about.trim()) answers.about = b.about.trim().slice(0, 1000);
  return answers;
}

// ---------------------------------------------------------------- major / minor
function interestAffinity(p: Pathway, interests: string[]) {
  return interests.reduce((sum, i) => sum + (p.interestWeights[i] ?? 0), 0);
}

function rankMajors(db: Db, cohort: Scored[], ans: QuestionnaireAnswers, goalPhrase: string): MajorRecommendation[] {
  const totalScore = cohort.reduce((s, x) => s + x.s, 0) || 1;
  const agg = new Map<string, { score: number; count: number }>();
  for (const { p, s } of cohort) {
    const e = agg.get(p.pathwayId) ?? { score: 0, count: 0 };
    e.score += s;
    e.count += 1;
    agg.set(p.pathwayId, e);
  }
  return [...agg.entries()]
    .map(([id, e]) => {
      const p = db.pathwayById.get(id)!;
      return { p, count: e.count, rank: e.score / totalScore + 0.3 * interestAffinity(p, ans.interests) };
    })
    .sort((a, b) => b.rank - a.rank || b.count - a.count)
    .map(({ p, count }) => ({
      pathwayId: p.id,
      major: p.major,
      degree: p.degree,
      college: p.college,
      description: p.description,
      evidence: {
        count,
        total: cohort.length,
        byTerm: null,
        baselinePct: null,
        text: `${count} of ${cohort.length} similar students who became ${goalPhrase} majored in ${p.major}.`,
      },
    }));
}

function chooseMinor(db: Db, group: Scored[], pathway: Pathway, groupLabel: string): MinorRecommendation | null {
  const own = OWN_MINOR[pathway.id];
  const minors = group.map((x) => x.p.minorId).filter((m): m is string => !!m && m !== own);
  const [top] = topCounts(minors, 1);
  if (!top || (top.count < 2 && group.length >= 6)) return null;
  const label = db.minorById.get(top.label)?.label ?? top.label;
  return {
    minorId: top.label,
    label,
    evidence: {
      count: top.count,
      total: group.length,
      byTerm: null,
      baselinePct: null,
      text: `${top.count} of ${group.length} ${groupLabel} minored in ${label}.`,
    },
  };
}

// ---------------------------------------------------------------- scheduling
/**
 * Greedy 8-term scheduler. `target` is the term similar students usually took each course.
 * Returns course -> term for everything it could place.
 */
function schedule(db: Db, codes: string[], target: Map<string, number>, isOptional: (c: string) => boolean) {
  const C = (code: string) => db.courseByCode.get(code)!;
  const set = new Set(codes);
  const dependents = new Map<string, string[]>(codes.map((c) => [c, []]));
  for (const c of codes) for (const pre of C(c).prereqs) if (set.has(pre)) dependents.get(pre)!.push(c);

  const offered = (code: string, t: number) => C(code).termsOffered.includes(seasonOf(t));
  const lastOffered = (code: string, t: number) => {
    while (t >= 1 && !offered(code, t)) t--;
    return t;
  };
  // latest term a course can be taken and still leave room for its dependent chain
  const latestMemo = new Map<string, number>();
  const latest = (code: string): number => {
    const hit = latestMemo.get(code);
    if (hit !== undefined) return hit;
    let L = lastOffered(code, TERMS);
    for (const d of dependents.get(code)!) L = Math.min(L, lastOffered(code, latest(d) - 1));
    latestMemo.set(code, L);
    return L;
  };
  const depthMemo = new Map<string, number>();
  const depth = (code: string): number => {
    const hit = depthMemo.get(code);
    if (hit !== undefined) return hit;
    const d = 1 + Math.max(0, ...C(code).prereqs.filter((p) => set.has(p)).map(depth));
    depthMemo.set(code, d);
    return d;
  };

  const placed = new Map<string, number>();
  const available = (code: string, t: number) =>
    !placed.has(code) && offered(code, t) && C(code).prereqs.every((p) => (placed.get(p) ?? 99) < t);
  const order = [...codes].sort(
    (a, b) =>
      (target.get(a) ?? 9) - (target.get(b) ?? 9) ||
      Number(isOptional(a)) - Number(isOptional(b)) ||
      depth(a) - depth(b) ||
      (a < b ? -1 : 1),
  );

  for (let t = 1; t <= TERMS; t++) {
    const remaining = codes.filter((c) => !placed.has(c)).reduce((s, c) => s + C(c).credits, 0);
    const goalLoad = Math.min(MAX_CREDITS, Math.max(MIN_CREDITS, Math.ceil(remaining / (TERMS - t + 1))));
    let load = 0;
    const take = (c: string) => {
      placed.set(c, t);
      load += C(c).credits;
    };
    // (a) forced: required courses at their latest possible term
    for (const c of order) if (!isOptional(c) && latest(c) <= t && available(c, t)) take(c);
    // (b) courses whose usual term has arrived (allow one term early)
    for (const c of order) {
      if (load >= goalLoad) break;
      if ((target.get(c) ?? 1) <= t + 1 && available(c, t) && load + C(c).credits <= MAX_CREDITS) take(c);
    }
    // (c) still light: pull required courses forward, then optional ones
    for (const pass of [false, true]) {
      for (const c of order) {
        if (load >= goalLoad) break;
        if (isOptional(c) === pass && available(c, t) && load + C(c).credits <= MAX_CREDITS) take(c);
      }
    }
  }
  return placed;
}

// ---------------------------------------------------------------- main
export function recommend(ans: QuestionnaireAnswers): RecommendationResponse {
  const db = getDb();
  const goal = db.goalById.get(ans.goal)!;
  const noun = goalNoun(goal.label);
  const goalPhrase = withArticle(noun);
  const C = (code: string) => db.courseByCode.get(code)!;

  // 1–2. similarity + evidence cohort
  const alumniScored: Scored[] = db.alumni.map((p) => ({ p, s: similarity(ans, p) })).sort(byIdThenScore);
  const cohort = alumniScored.filter((x) => x.p.goal === ans.goal).slice(0, COHORT_MAX);

  // 3. major
  const ranked = rankMajors(db, cohort, ans, goalPhrase);
  let major: MajorRecommendation;
  if (ans.pathwayId) {
    const p = db.pathwayById.get(ans.pathwayId)!;
    const existing = ranked.find((m) => m.pathwayId === p.id);
    major = existing ?? {
      pathwayId: p.id,
      major: p.major,
      degree: p.degree,
      college: p.college,
      description: p.description,
      evidence: {
        count: 0,
        total: cohort.length,
        byTerm: null,
        baselinePct: null,
        text: `You chose ${p.major}. None of the ${cohort.length} most similar students who became ${goalPhrase} majored in it, so this plan follows similar ${p.major} alumni instead.`,
      },
    };
  } else {
    major = ranked[0];
  }
  const pathway = db.pathwayById.get(major.pathwayId)!;
  const alternativeMajors = ranked.filter((m) => m.pathwayId !== pathway.id).slice(0, 3);

  // Major group M: cohort members in the major, or (if too few) the most similar alumni of that major.
  let group = cohort.filter((x) => x.p.pathwayId === pathway.id);
  let groupLabel = `similar ${pathway.major} students who became ${goalPhrase}`;
  if (group.length < 3) {
    group = alumniScored.filter((x) => x.p.pathwayId === pathway.id).slice(0, 20);
    groupLabel = `similar ${pathway.major} alumni`;
  }

  // 4. minor
  const minor = chooseMinor(db, group, pathway, groupLabel);

  // course stats for the cohort and the major group
  const takersTerms = (g: Scored[], code: string) =>
    g.map((x) => db.termsByPerson.get(x.p.id)?.get(code)).filter((t): t is number => t !== undefined);
  const cohortCount = (code: string) => takersTerms(cohort, code).length;
  const groupCount = (code: string) => takersTerms(group, code).length;
  const nursingOnly = (code: string) => C(code).dept === "NURS" && pathway.id !== "nursing";

  // 5. course selection
  const reasons = new Map<string, CourseReason>();
  const add = (code: string, r: CourseReason) => {
    if (!reasons.has(code) && db.courseByCode.has(code)) reasons.set(code, r);
  };
  const popularity = (a: string, b: string) =>
    groupCount(b) - groupCount(a) || cohortCount(b) - cohortCount(a) || (a < b ? -1 : 1);

  const majorReq = db.majorReqById.get(pathway.id)!;
  const genEd = db.reqs.genEd;
  genEd.required.forEach((c) => add(c, "gen_ed"));
  majorReq.core.forEach((c) => add(c, "major_core"));
  majorReq.electivePool
    .filter((c) => !reasons.has(c))
    .sort(popularity)
    .slice(0, majorReq.electivesRequired)
    .forEach((c) => add(c, "major_elective"));
  if (minor) {
    const req = db.minorReqById.get(minor.minorId)!;
    const already = req.courses.filter((c) => reasons.has(c)).length;
    req.courses
      .filter((c) => !reasons.has(c) && !nursingOnly(c))
      .sort(popularity)
      .slice(0, Math.max(0, req.coursesRequired - already))
      .forEach((c) => add(c, "minor"));
  }
  // goal signal: taken by the cohort much more often than by alumni overall
  db.courses
    .filter((c) => !reasons.has(c.code) && !nursingOnly(c.code))
    .map((c) => {
      const rate = cohortCount(c.code) / Math.max(1, cohort.length);
      const base = db.baselineRate.get(c.code) ?? 0;
      return { code: c.code, rate, base, lift: rate - base };
    })
    .filter((x) => x.rate >= 0.35 && x.rate >= 1.5 * x.base)
    .sort((a, b) => b.lift - a.lift || (a.code < b.code ? -1 : 1))
    .slice(0, GOAL_SIGNAL_MAX)
    .forEach((x) => add(x.code, "goal_signal"));
  genEd.electivePool
    .filter((c) => !reasons.has(c))
    .sort(popularity)
    .slice(0, Math.max(0, genEd.electivesRequired - genEd.electivePool.filter((c) => reasons.has(c)).length))
    .forEach((c) => add(c, "gen_ed"));
  // prerequisite closure
  const prereqFor = new Map<string, string>();
  const close = (code: string) => {
    for (const pre of C(code).prereqs) {
      if (!reasons.has(pre)) {
        add(pre, "prerequisite");
        prereqFor.set(pre, code);
        close(pre);
      }
    }
  };
  [...reasons.keys()].forEach(close);
  // free electives (popular with the major group, no new prereqs) to reach the credit total
  const credits = () => [...reasons.keys()].reduce((s, c) => s + C(c).credits, 0);
  const fillers = db.courses
    .filter(
      (c) =>
        !reasons.has(c.code) &&
        !nursingOnly(c.code) &&
        c.level <= 300 &&
        c.prereqs.every((p) => reasons.has(p)) &&
        groupCount(c.code) > 0,
    )
    .map((c) => c.code)
    .sort(popularity);
  for (const f of fillers) {
    if (credits() >= pathway.creditsToGraduate) break;
    if (C(f).prereqs.every((p) => reasons.has(p))) add(f, "elective");
  }

  // 6. schedule at the term similar students usually took each course
  const codes = [...reasons.keys()];
  const target = new Map<string, number>();
  const LEVEL_TERM: Record<number, number> = { 100: 1, 200: 3, 300: 5, 400: 7 };
  for (const code of codes) {
    const terms = [...takersTerms(group, code), ...takersTerms(cohort, code)];
    target.set(code, median(terms) ?? LEVEL_TERM[C(code).level] ?? 4);
  }
  const isOptional = (c: string) => reasons.get(c) === "elective";
  const placed = schedule(db, codes, target, isOptional);
  const warnings = codes
    .filter((c) => !placed.has(c) && !isOptional(c))
    .map((c) => `${c} could not be scheduled within 8 terms.`);

  // evidence per course
  const REASON_LABEL: Record<CourseReason, string> = {
    gen_ed: "University requirement",
    major_core: "Major requirement",
    major_elective: "Major elective",
    minor: "Minor requirement",
    goal_signal: "Strong signal for your goal",
    prerequisite: "Prerequisite",
    elective: "Popular elective",
  };
  // Major/minor/elective evidence comes from the major group (only they take major courses);
  // gen-ed, goal-signal and prerequisite evidence comes from the whole goal cohort.
  const minorGroup = minor ? group.filter((x) => x.p.minorId === minor.minorId) : [];
  const courseEvidence = (code: string, reason: CourseReason): Evidence => {
    const useGroup = reason === "major_core" || reason === "major_elective" || reason === "elective";
    const useMinor = reason === "minor" && minorGroup.length > 0;
    const g = useMinor ? minorGroup : useGroup ? group : cohort;
    const who = useMinor
      ? `${groupLabel} with a ${minor!.label} minor`
      : useGroup
        ? groupLabel
        : `similar students who became ${goalPhrase}`;
    const terms = takersTerms(g, code);
    const count = terms.length;
    const total = g.length;
    const byTerm = median(terms);
    const basePct = pct(db.baselineRate.get(code) ?? 0);
    const took =
      count > 0
        ? `${count} of ${total} ${who} took it${byTerm ? `, usually by term ${byTerm}` : ""}`
        : `None of the ${total} ${who} took it`;
    let text: string;
    switch (reason) {
      case "goal_signal":
        text = `${took}, compared with ${basePct}% of all alumni.`;
        break;
      case "major_core":
        text = `Required for ${pathway.major}. ${took}.`;
        break;
      case "major_elective":
        text = `Counts toward ${pathway.major} electives. ${took}.`;
        break;
      case "minor":
        text = `Counts toward the ${minor?.label} minor. ${took}.`;
        break;
      case "prerequisite":
        text = `Needed before ${prereqFor.get(code) ?? "a later course"}. ${took}.`;
        break;
      case "elective":
        text = `Popular elective. ${took}.`;
        break;
      default:
        text = `${took}.`;
    }
    return { count, total, byTerm, baselinePct: basePct, text };
  };

  const plan: PlanTerm[] = Array.from({ length: TERMS }, (_, i) => {
    const t = i + 1;
    const courses: PlanCourse[] = codes
      .filter((c) => placed.get(c) === t)
      .sort((a, b) => (a < b ? -1 : 1))
      .map((code) => {
        const c: Course = C(code);
        const reason = reasons.get(code)!;
        return {
          code,
          title: c.title,
          credits: c.credits,
          prereqs: c.prereqs,
          termsOffered: c.termsOffered,
          description: c.description,
          reason,
          reasonLabel: REASON_LABEL[reason],
          evidence: courseEvidence(code, reason),
        };
      });
    return { term: t, season: seasonOf(t), label: termLabel(t), credits: courses.reduce((s, c) => s + c.credits, 0), courses };
  });

  // 7. similar-students summary
  const outcomes = cohort.map((x) => db.outcomeByPerson.get(x.p.id)).filter((o) => !!o);
  const similar: SimilarSummary = {
    cohortSize: cohort.length,
    goalLabel: goal.label,
    majors: topCounts(cohort.map((x) => db.pathwayById.get(x.p.pathwayId)!.major), 5),
    jobTitles: topCounts(outcomes.map((o) => o.jobTitle), 5),
    employers: topCounts(outcomes.map((o) => o.employer), 5),
    gradSchoolCount: outcomes.filter((o) => o.gradSchool).length,
    seniorsWithSameGoal: db.people.filter((p) => p.type === "senior" && p.goal === ans.goal).length,
  };

  // 8. clubs
  const clubs: ClubRecommendation[] = topCounts(cohort.flatMap((x) => x.p.clubIds), 3)
    .filter((c) => c.count >= 2)
    .map(({ label: id, count }) => {
      const club = db.clubById.get(id)!;
      return {
        id,
        name: club.name,
        description: club.description,
        evidence: {
          count,
          total: cohort.length,
          byTerm: null,
          baselinePct: null,
          text: `${count} of ${cohort.length} similar students who became ${goalPhrase} were members.`,
        },
      };
    });

  return {
    answers: ans,
    goalLabel: goal.label,
    major,
    alternativeMajors,
    minor,
    plan,
    totalCredits: plan.reduce((s, t) => s + t.credits, 0),
    creditsToGraduate: pathway.creditsToGraduate,
    warnings,
    similar,
    mentors: listMentors({ ...ans, pathwayId: pathway.id, limit: MENTOR_LIMIT }).mentors,
    clubs,
    methodology: [
      `We compared your answers with ${db.people.length} synthetic alumni and seniors: 50% weight on the same goal, 30% on shared interests, 20% on shared background.`,
      `Your evidence group is the ${cohort.length} alumni most similar to you who became ${goalPhrase}.`,
      `Courses are placed in the term those students usually took them, while respecting prerequisites, the semesters each course is offered, and an ${MAX_CREDITS}-credit limit per term.`,
      `"Strong signal" courses are ones your evidence group took much more often than alumni overall.`,
    ],
    syntheticNote: db.syntheticNote,
  };
}

// ---------------------------------------------------------------- mentors
export interface MentorQuery {
  goal?: string;
  interests?: string[];
  background?: string[];
  pathwayId?: string;
  topic?: string;
  mentorsOnly?: boolean;
  limit?: number;
}

export function listMentors(q: MentorQuery): { mentors: Mentor[]; total: number } {
  const db = getDb();
  const ans = { goal: q.goal ?? "", interests: q.interests ?? [], background: q.background ?? [] };
  const candidates = db.people
    .map((p) => ({ p, o: db.optInByPerson.get(p.id)! }))
    .filter(({ o }) => o?.shareContact)
    .filter(({ o }) => !q.mentorsOnly || o.isMentor)
    .filter(({ o }) => !q.topic || o.mentorTopics.includes(q.topic))
    .map(({ p, o }) => {
      let s = similarity(ans, p);
      const reasons: string[] = [];
      const goal = db.goalById.get(p.goal)!;
      if (ans.goal && p.goal === ans.goal) reasons.push(p.type === "alumni" ? `Became ${withArticle(goalNoun(goal.label))}` : `Also aiming for ${goalNoun(goal.label)}`);
      if (q.pathwayId && p.pathwayId === q.pathwayId) {
        s += 0.15;
        reasons.push(`${db.pathwayById.get(p.pathwayId)!.major} major`);
      }
      const shared = p.interests.filter((i) => ans.interests.includes(i)).map((i) => db.interestById.get(i)!.label);
      if (shared.length) reasons.push(`Shares interests: ${shared.join(", ")}`);
      if (ans.background.includes("first_gen") && p.background.includes("first_gen")) {
        s += 0.05;
        reasons.push("Also a first-gen student");
      }
      if (ans.background.includes("transfer_student") && p.isTransfer) {
        s += 0.05;
        reasons.push("Also a transfer student");
      }
      if (o.isMentor) s += 0.1;
      return { p, o, s, reasons };
    })
    .sort((a, b) => b.s - a.s || (a.p.id < b.p.id ? -1 : 1));

  const maxScore = W_GOAL + W_INTERESTS + W_BACKGROUND + 0.35;
  const mentors: Mentor[] = candidates.slice(0, q.limit ?? 24).map(({ p, o, s, reasons }) => {
    const out = db.outcomeByPerson.get(p.id);
    return {
      id: p.id,
      name: `${p.firstName} ${p.lastName}`,
      type: p.type,
      major: db.pathwayById.get(p.pathwayId)!.major,
      minor: p.minorId ? (db.minorById.get(p.minorId)?.label ?? null) : null,
      gradYear: p.gradYear,
      goalLabel: db.goalById.get(p.goal)!.label,
      jobTitle: out?.jobTitle ?? null,
      employer: out?.employer ?? null,
      city: out?.city ?? null,
      gradSchool: out?.gradSchool ? `${out.gradSchool.degree}, ${out.gradSchool.program} (${out.gradSchool.institution})` : null,
      bio: p.bio,
      matchScore: Math.min(100, Math.round((s / maxScore) * 100)),
      matchReasons: reasons,
      isMentor: o.isMentor,
      mentorTopics: o.mentorTopics.map((t) => db.topicById.get(t)!).filter(Boolean),
      maxMentees: o.maxMentees,
      email: o.email,
      linkedinUrl: o.linkedinUrl,
    };
  });
  return { mentors, total: candidates.length };
}
