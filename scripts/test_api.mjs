#!/usr/bin/env node
/**
 * test_api.mjs: end-to-end checks against a running server (default http://localhost:3000).
 *
 * For every goal in /api/options (plus a few hand-picked personas and major overrides) it calls
 * POST /api/recommendations and verifies the returned plan:
 *   - 8 terms, seasons alternate Fall/Spring
 *   - every prereq is placed in a strictly earlier term
 *   - every course is offered in the season it is placed in
 *   - no duplicate courses, max 18 credits per term
 *   - major core + gen-ed required courses are all present, no scheduling warnings
 *   - every course, the major and the minor have evidence text with count <= total
 *   - mentors are returned and all have shared contact details
 * Also checks input validation (400s) and GET /api/mentors filters.
 *
 * Usage: node scripts/test_api.mjs [baseUrl]
 */
import { readFileSync } from "node:fs";

const BASE = process.argv[2] ?? "http://localhost:3000";
const courses = new Map(JSON.parse(readFileSync("data/courses.json", "utf8")).courses.map((c) => [c.code, c]));
const reqs = JSON.parse(readFileSync("data/degree_requirements.json", "utf8"));
const failures = [];
const fail = (ctx, msg) => failures.push(`${ctx}: ${msg}`);

async function post(body) {
  const r = await fetch(`${BASE}/api/recommendations`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: r.status, json: await r.json() };
}

function checkPlan(ctx, res) {
  if (res.plan.length !== 8) fail(ctx, `plan has ${res.plan.length} terms`);
  const termOf = new Map();
  for (const t of res.plan) {
    if (t.season !== (t.term % 2 ? "Fall" : "Spring")) fail(ctx, `term ${t.term} season ${t.season}`);
    if (t.credits > 18) fail(ctx, `term ${t.term} has ${t.credits} credits`);
    for (const c of t.courses) {
      if (termOf.has(c.code)) fail(ctx, `duplicate ${c.code}`);
      termOf.set(c.code, t.term);
      const cat = courses.get(c.code);
      if (!cat) fail(ctx, `unknown course ${c.code}`);
      else if (!cat.termsOffered.includes(t.season)) fail(ctx, `${c.code} not offered in ${t.season}`);
      if (!c.evidence?.text || c.evidence.count > c.evidence.total) fail(ctx, `${c.code} bad evidence`);
    }
  }
  for (const [code, term] of termOf) {
    for (const pre of courses.get(code)?.prereqs ?? []) {
      if (!termOf.has(pre)) fail(ctx, `${code} missing prereq ${pre}`);
      else if (termOf.get(pre) >= term) fail(ctx, `${code} (t${term}) prereq ${pre} at t${termOf.get(pre)}`);
    }
  }
  const major = reqs.majors.find((m) => m.pathwayId === res.major.pathwayId);
  for (const code of [...major.core, ...reqs.genEd.required]) if (!termOf.has(code)) fail(ctx, `missing required ${code}`);
  if (res.warnings.length) fail(ctx, `warnings: ${res.warnings.join("; ")}`);
  if (!res.major.evidence.text) fail(ctx, "major evidence missing");
  if (res.minor && !res.minor.evidence.text) fail(ctx, "minor evidence missing");
  if (!res.mentors.length) fail(ctx, "no mentors");
  if (res.mentors.some((m) => !m.email || !m.linkedinUrl)) fail(ctx, "mentor without contact");
  if (res.totalCredits < res.creditsToGraduate - 8) fail(ctx, `only ${res.totalCredits}/${res.creditsToGraduate} credits`);
}

const options = await (await fetch(`${BASE}/api/options`)).json();
const personas = options.goals.map((g) => ({ goal: g.id, interests: [], background: [] }));
personas.push(
  { goal: "data_analyst", interests: ["psychology_behavior", "data_statistics"], background: ["first_gen"] },
  { goal: "physician", interests: ["life_sciences", "healthcare"], background: ["ap_bio_chem"] },
  { goal: "software_engineer", interests: ["programming", "ai_ml"], background: ["ap_cs", "strong_math"] },
  { goal: "ux_designer", interests: ["visual_design", "psychology_behavior"], background: ["art_portfolio"] },
  { goal: "product_manager", interests: ["business_strategy", "programming"], background: ["transfer_student"] },
);
for (const p of options.pathways) personas.push({ goal: "data_analyst", interests: ["data_statistics"], background: [], pathwayId: p.id });

const summary = [];
for (const body of personas) {
  const ctx = `${body.goal}${body.pathwayId ? `@${body.pathwayId}` : ""}[${body.interests.join(",")}]`;
  const { status, json } = await post(body);
  if (status !== 200) {
    fail(ctx, `HTTP ${status} ${JSON.stringify(json)}`);
    continue;
  }
  checkPlan(ctx, json);
  summary.push(`${ctx.padEnd(60)} -> ${json.major.major} / ${json.minor?.label ?? "no minor"}, ${json.totalCredits} cr, ${json.mentors.length} mentors`);
}

// validation
for (const bad of [{}, { goal: "astronaut" }, "nope"]) {
  const { status } = await post(bad);
  if (status !== 400) fail("validation", `${JSON.stringify(bad)} returned ${status}`);
}
const m = await (await fetch(`${BASE}/api/mentors?goal=physician&topic=grad_school_applications&mentorsOnly=true`)).json();
if (!m.mentors.length || m.mentors.some((x) => !x.isMentor || !x.mentorTopics.some((t) => t.id === "grad_school_applications")))
  fail("mentors", "filter not applied");

console.log(summary.join("\n"));
if (failures.length) {
  console.error(`\nFAIL: ${failures.length} problem(s)`);
  failures.slice(0, 40).forEach((f) => console.error("  - " + f));
  process.exit(1);
}
console.log(`\nOK: ${personas.length} plans verified, validation and mentor filters OK.`);
