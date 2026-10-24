/**
 * Server-only loader for the SYNTHETIC JSON "tables" in /data.
 * Files are read once per server instance and indexed in memory.
 * Never import this from a client component (enrollments.json is ~4 MB).
 */
import fs from "node:fs";
import path from "node:path";

export type Season = "Fall" | "Spring";

export interface Tag {
  id: string;
  label: string;
}
export interface Goal extends Tag {
  requiresGradSchool: boolean;
}
export interface Minor extends Tag {
  dept: string;
}
export interface Taxonomy {
  interests: Tag[];
  background: Tag[];
  goals: Goal[];
  mentorTopics: Tag[];
  minors: Minor[];
}
export interface Pathway {
  id: string;
  major: string;
  degree: string;
  dept: string;
  college: string;
  description: string;
  creditsToGraduate: number;
  populationShare: number;
  interestWeights: Record<string, number>;
  backgroundWeights: Record<string, number>;
  minorRate: number;
  minorWeights: Record<string, number>;
  outcomeWeights: Record<string, number>;
}
export interface Course {
  code: string;
  dept: string;
  number: number;
  title: string;
  credits: number;
  level: number;
  prereqs: string[];
  termsOffered: Season[];
  category: string;
  tags: string[];
  relevantGoals: string[];
  description: string;
}
export interface MajorReq {
  pathwayId: string;
  core: string[];
  electivePool: string[];
  electivesRequired: number;
}
export interface MinorReq {
  minorId: string;
  courses: string[];
  coursesRequired: number;
}
export interface DegreeRequirements {
  genEd: { required: string[]; electivePool: string[]; electivesRequired: number };
  majors: MajorReq[];
  minors: MinorReq[];
}
export interface Person {
  id: string;
  firstName: string;
  lastName: string;
  type: "alumni" | "senior";
  pathwayId: string;
  minorId: string | null;
  previousPathwayId: string | null;
  entryYear: number;
  gradYear: number;
  isTransfer: boolean;
  interests: string[];
  background: string[];
  goal: string;
  clubIds: string[];
  bio: string;
}
interface Enrollment {
  personId: string;
  courseCode: string;
  term: number;
  season: Season;
  year: number;
  status: string;
}
export interface Outcome {
  personId: string;
  goalId: string;
  jobTitle: string;
  employer: string;
  industry: string;
  city: string;
  startYear: number;
  gradSchool: { degree: string; program: string; institution: string } | null;
}
export interface OptIn {
  personId: string;
  shareContact: boolean;
  email: string | null;
  linkedinUrl: string | null;
  isMentor: boolean;
  mentorTopics: string[];
  maxMentees: number;
}
export interface Club {
  id: string;
  name: string;
  description: string;
  tags: string[];
  relevantGoals: string[];
}

export interface Db {
  taxonomy: Taxonomy;
  pathways: Pathway[];
  courses: Course[];
  reqs: DegreeRequirements;
  people: Person[];
  alumni: Person[];
  clubs: Club[];
  goalById: Map<string, Goal>;
  interestById: Map<string, Tag>;
  backgroundById: Map<string, Tag>;
  topicById: Map<string, Tag>;
  minorById: Map<string, Minor>;
  pathwayById: Map<string, Pathway>;
  courseByCode: Map<string, Course>;
  majorReqById: Map<string, MajorReq>;
  minorReqById: Map<string, MinorReq>;
  personById: Map<string, Person>;
  /** personId -> (courseCode -> term) */
  termsByPerson: Map<string, Map<string, number>>;
  outcomeByPerson: Map<string, Outcome>;
  optInByPerson: Map<string, OptIn>;
  clubById: Map<string, Club>;
  /** courseCode -> share (0–1) of all alumni who took it */
  baselineRate: Map<string, number>;
  syntheticNote: string;
}

const DATA_DIR = path.join(process.cwd(), "data");

function load<T>(file: string): T {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), "utf8")) as T;
}

const byId = <T, K extends keyof T>(list: T[], key: K) =>
  new Map(list.map((x) => [x[key] as unknown as string, x]));

let cache: Db | null = null;

export function getDb(): Db {
  if (cache) return cache;

  const taxonomy = load<Taxonomy>("taxonomy.json");
  const { pathways } = load<{ pathways: Pathway[] }>("pathways.json");
  const { courses } = load<{ courses: Course[] }>("courses.json");
  const reqs = load<DegreeRequirements>("degree_requirements.json");
  const { people } = load<{ people: Person[] }>("people.json");
  const { enrollments } = load<{ enrollments: Enrollment[] }>("enrollments.json");
  const { outcomes } = load<{ outcomes: Outcome[] }>("outcomes.json");
  const { optIns } = load<{ optIns: OptIn[] }>("opt_ins.json");
  const { clubs } = load<{ clubs: Club[] }>("clubs.json");

  const termsByPerson = new Map<string, Map<string, number>>();
  for (const p of people) termsByPerson.set(p.id, new Map());
  for (const e of enrollments) termsByPerson.get(e.personId)?.set(e.courseCode, e.term);

  const alumni = people.filter((p) => p.type === "alumni");
  const takenCount = new Map<string, number>();
  for (const a of alumni) {
    for (const code of termsByPerson.get(a.id)?.keys() ?? []) {
      takenCount.set(code, (takenCount.get(code) ?? 0) + 1);
    }
  }
  const baselineRate = new Map(courses.map((c) => [c.code, (takenCount.get(c.code) ?? 0) / alumni.length]));

  cache = {
    taxonomy,
    pathways,
    courses,
    reqs,
    people,
    alumni,
    clubs,
    goalById: byId(taxonomy.goals, "id"),
    interestById: byId(taxonomy.interests, "id"),
    backgroundById: byId(taxonomy.background, "id"),
    topicById: byId(taxonomy.mentorTopics, "id"),
    minorById: byId(taxonomy.minors, "id"),
    pathwayById: byId(pathways, "id"),
    courseByCode: byId(courses, "code"),
    majorReqById: byId(reqs.majors, "pathwayId"),
    minorReqById: byId(reqs.minors, "minorId"),
    personById: byId(people, "id"),
    termsByPerson,
    outcomeByPerson: byId(outcomes, "personId"),
    optInByPerson: byId(optIns, "personId"),
    clubById: byId(clubs, "id"),
    baselineRate,
    syntheticNote:
      "All students, alumni, courses, employers and outcomes are synthetic (fictional Ridgeview State University).",
  };
  return cache;
}
