/**
 * API contract for the Degree Pathway Suggester.
 * Source of truth for request/response shapes shared by the frontend and the API routes.
 * All data behind these endpoints is SYNTHETIC.
 *
 * Endpoints
 *   GET  /api/options          -> OptionsResponse
 *   POST /api/recommendations  body: QuestionnaireAnswers -> RecommendationResponse (400 -> ApiError)
 *   GET  /api/mentors?goal=&pathwayId=&topic=&mentorsOnly=true&limit= -> MentorsResponse
 */

export type Season = "Fall" | "Spring";

export interface Option {
  id: string;
  label: string;
}

export interface PathwayOption extends Option {
  degree: string;
  college: string;
  description: string;
}

export interface OptionsResponse {
  interests: Option[];
  background: Option[];
  goals: Option[];
  pathways: PathwayOption[];
  mentorTopics: Option[];
  syntheticNote: string;
}

export interface QuestionnaireAnswers {
  /** goal id from OptionsResponse.goals (required) */
  goal: string;
  /** interest ids (pick 1–4) */
  interests: string[];
  /** background ids (0–3) */
  background: string[];
  /** optional: force the plan for this major instead of the recommended one */
  pathwayId?: string;
}

/** Why a recommendation was made. `text` is ready to display. */
export interface Evidence {
  /** number of similar students supporting this item */
  count: number;
  /** size of the group `count` is out of */
  total: number;
  /** median term (1–8) in which supporting students took the course; null when not applicable */
  byTerm: number | null;
  /** % of ALL alumni who took the course (for comparison); null when not applicable */
  baselinePct: number | null;
  text: string;
}

export interface MajorRecommendation {
  pathwayId: string;
  major: string;
  degree: string;
  college: string;
  description: string;
  evidence: Evidence;
}

export interface MinorRecommendation {
  minorId: string;
  label: string;
  evidence: Evidence;
}

export type CourseReason =
  | "gen_ed"
  | "major_core"
  | "major_elective"
  | "minor"
  | "goal_signal"
  | "prerequisite"
  | "elective";

export interface PlanCourse {
  code: string;
  title: string;
  credits: number;
  prereqs: string[];
  termsOffered: Season[];
  description: string;
  reason: CourseReason;
  /** short label for the reason, e.g. "Major requirement", "Strong signal for your goal" */
  reasonLabel: string;
  evidence: Evidence;
}

export interface PlanTerm {
  term: number; // 1–8
  season: Season;
  /** e.g. "Year 1 · Fall" */
  label: string;
  credits: number;
  courses: PlanCourse[];
}

export interface CountItem {
  label: string;
  count: number;
}

export interface SimilarSummary {
  /** alumni in the evidence group (same goal, most similar profiles) */
  cohortSize: number;
  goalLabel: string;
  majors: CountItem[];
  jobTitles: CountItem[];
  employers: CountItem[];
  /** count of the cohort who went to grad school */
  gradSchoolCount: number;
  /** current seniors with the same intended goal */
  seniorsWithSameGoal: number;
}

export interface Mentor {
  id: string;
  name: string;
  type: "alumni" | "senior";
  major: string;
  minor: string | null;
  gradYear: number;
  goalLabel: string;
  jobTitle: string | null;
  employer: string | null;
  city: string | null;
  gradSchool: string | null;
  bio: string;
  /** 0–100 match score */
  matchScore: number;
  matchReasons: string[];
  isMentor: boolean;
  mentorTopics: Option[];
  maxMentees: number;
  email: string | null;
  linkedinUrl: string | null;
}

export interface ClubRecommendation {
  id: string;
  name: string;
  description: string;
  evidence: Evidence;
}

export interface RecommendationResponse {
  answers: QuestionnaireAnswers;
  goalLabel: string;
  major: MajorRecommendation;
  alternativeMajors: MajorRecommendation[];
  minor: MinorRecommendation | null;
  plan: PlanTerm[];
  totalCredits: number;
  creditsToGraduate: number;
  /** required courses that could not be scheduled (should normally be empty) */
  warnings: string[];
  similar: SimilarSummary;
  mentors: Mentor[];
  clubs: ClubRecommendation[];
  methodology: string[];
  syntheticNote: string;
}

export interface MentorsResponse {
  mentors: Mentor[];
  total: number;
  syntheticNote: string;
}

export interface ApiError {
  error: string;
}
