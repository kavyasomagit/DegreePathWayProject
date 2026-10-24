# Data Schema: Degree Pathway Suggester (SYNTHETIC DATA)

All data in this folder is synthetic and generated for a hackathon proof of concept.
The university is fictional: **Ridgeview State University**. Employers, grad schools, and people are fictional.

Each file is one JSON object with a `_note` string and one top-level array (the "table").
IDs are stable strings. Arrays of ids reference other tables (foreign keys).

## Term model

- 8 semesters. Term 1 = Fall of `entryYear`, term 2 = Spring of `entryYear + 1`, term 3 = Fall of `entryYear + 1`, ...
- Odd terms are `"Fall"`, even terms are `"Spring"`.
- `year` for term t = `entryYear + floor(t / 2)`.

## Files

### taxonomy.json (hand-authored, do not change ids)
`interests[]`, `background[]`, `goals[]`, `mentorTopics[]`, `minors[]`, each `{ id, label, ... }`.

### pathways.json (hand-authored, do not change ids)
`pathways[]`: `{ id, major, degree, dept, college, description, creditsToGraduate, populationShare, interestWeights, backgroundWeights, minorRate, minorWeights, outcomeWeights }`.

### courses.json -> `courses[]`
| field | type | notes |
|---|---|---|
| code | string | `"<DEPT> <NUMBER>"`, e.g. `"CS 101"`. Unique. |
| dept | string | e.g. `"CS"`, `"MATH"`, `"STAT"`, `"ENGL"` |
| number | number | 100–499; first digit = level |
| title | string | |
| credits | number | 1–5 (most are 3 or 4) |
| level | number | 100, 200, 300, or 400 |
| prereqs | string[] | course codes, ALL required (AND). Must exist. No cycles. |
| termsOffered | ("Fall"\|"Spring")[] | non-empty |
| category | string | `"gen_ed"`, `"major_core"`, `"major_elective"`, `"minor"`, `"free_elective"` (primary role) |
| tags | string[] | interest ids from taxonomy |
| relevantGoals | string[] | goal ids this course is especially useful for (drives goal-specific electives) |
| description | string | one sentence |

### degree_requirements.json
```json
{
  "_note": "...",
  "genEd": { "required": ["ENGL 101", "..."], "electivePool": ["..."], "electivesRequired": 2 },
  "majors": [ { "pathwayId": "computer_science", "core": ["CS 101", "..."], "electivePool": ["..."], "electivesRequired": 4 } ],
  "minors": [ { "minorId": "statistics", "courses": ["STAT 210", "..."], "coursesRequired": 4 } ]
}
```
Every pathway and every minor in the taxonomy has exactly one entry.

### people.json -> `people[]` (alumni + current seniors)
| field | type | notes |
|---|---|---|
| id | string | `"A0001"` for alumni, `"S0001"` for seniors |
| firstName, lastName | string | diverse, realistic, fictional |
| type | `"alumni"` \| `"senior"` | |
| pathwayId | string | final major (FK pathways) |
| minorId | string \| null | FK taxonomy.minors |
| previousPathwayId | string \| null | set if the person switched majors (switch happens after term 2 or 3) |
| entryYear | number | alumni: 2012–2021; seniors: 2023 |
| gradYear | number | alumni: year they graduated (usually entryYear + 4); seniors: expected 2027 |
| isTransfer | boolean | transfer students have terms 1–2 as `transfer_credit` enrollments |
| interests | string[] | 2–4 interest ids |
| background | string[] | 1–3 background ids |
| goal | string | goal id. Alumni: equals their outcome goal. Seniors: intended goal. |
| clubIds | string[] | 0–3 FK clubs |
| bio | string | one short sentence |

### enrollments.json -> `enrollments[]`
| field | type | notes |
|---|---|---|
| personId | string | FK people |
| courseCode | string | FK courses |
| term | number | 1–8 |
| season | `"Fall"` \| `"Spring"` | matches term parity |
| year | number | matches term-year rule |
| status | `"completed"` \| `"in_progress"` \| `"transfer_credit"` | |

Seniors (entryYear 2023): terms 1–6 `completed`, term 7 (Fall 2026) `in_progress`, no term 8 rows.

### outcomes.json -> `outcomes[]` (alumni only, exactly one per alumnus)
| field | type | notes |
|---|---|---|
| personId | string | FK people (alumni) |
| goalId | string | FK taxonomy.goals; equals the person's `goal` |
| jobTitle | string | e.g. "Data Analyst II", "Resident Physician" |
| employer | string | fictional |
| industry | string | e.g. "Technology", "Healthcare", "Financial Services" |
| city | string | real US city is fine |
| startYear | number | >= gradYear (grad-school goals: start after grad program) |
| gradSchool | `{ degree, program, institution }` \| null | required when the goal `requiresGradSchool` |

### opt_ins.json -> `optIns[]` (exactly one row per person)
| field | type | notes |
|---|---|---|
| personId | string | FK people |
| shareContact | boolean | |
| email | string \| null | only when shareContact; domain `@example.edu` or `@example.com` |
| linkedinUrl | string \| null | only when shareContact; `https://linkedin.example.com/in/<handle>` (fake domain so we never point at a real person) |
| isMentor | boolean | isMentor implies shareContact |
| mentorTopics | string[] | FK taxonomy.mentorTopics; non-empty iff isMentor |
| maxMentees | number | 0 if not mentor, else 1–4 |

### clubs.json -> `clubs[]`
`{ id, name, description, tags: interestId[], relevantGoals: goalId[] }`, about 25 clubs.

## Generator notes

These notes describe how `DegreePathWayProject_Scripts/generate_data.mjs` (seed 20261024) fills in details the rules above leave open. They add to the rules above and do not replace any of them.

- **Determinism:** with the fixed seed, every run produces byte-identical files.
- **Courses:** every course has at least one `tags` entry and at least one `relevantGoals` entry. About 28% of courses are offered in only one season.
- **Credits:** every term has 12–18 credits. For seniors this includes the in-progress term 7. Alumni totals are at or above `creditsToGraduate` and run at most a few credits over.
- **Gen-ed electives** may overlap a major's core (for example, PSYC 101 for Psychology majors).
- **Minors:** a minor is complete when the person took at least `coursesRequired` courses from `minors[].courses`. Those courses may also count toward the major (for example, the Chemistry minor for Biology (Pre-Med)).
- **Alumni years:** all alumni have `gradYear = entryYear + 4` and rows in all 8 terms.
- **Transfers:** `isTransfer === true` exactly when `background` includes `"transfer_student"`, and `background` still has 1–3 entries. `transfer_credit` rows appear only in terms 1–2 and only for courses with `category: "gen_ed"`. No person is both a transfer and a switcher.
- **Switchers:** each switcher has at least one course from the previous major's dept in terms 1..switchTerm, where the switch happens after term 2 or 3. Non-gen-ed courses in the new major's dept start only after the switch.
- **Outcomes:**
  - `startYear` is always between `gradYear` and 2026, since term 7 for seniors is Fall 2026.
  - To keep grad-school timelines realistic, alumni with grad-school goals have capped entry years: physician and nurse_practitioner ≤ 2018, research_scientist ≤ 2017, mental_health_counselor ≤ 2020.
  - Some alumni whose goals do not require grad school still have a `gradSchool` (MBA or MS). These all have `gradYear ≤ 2022`.
- **Opt-ins:**
  - Alumni emails use `@example.com`. Senior emails use `@example.edu`.
  - LinkedIn handles follow the pattern `first-last-<id lowercased>`.
  - Seniors who mentor have `maxMentees` of 1–2.
- **Mentor topic eligibility:**
  - `grad_school_applications` is limited to alumni whose goal has `requiresGradSchool`.
  - `research_opportunities` is limited to people with a research-oriented goal or the `research` interest.
  - `first_gen_support` requires the `first_gen` background. `transfer_support` requires `isTransfer`. `switching_majors` requires `previousPathwayId`.
- **Clubs:** `first_gen_scholars` members are all first-gen. `transfer_student_network` members are all transfers.
- **Ordering:** `clubIds` follow the order of clubs.json. `mentorTopics` follow taxonomy order.
- **Self-check:** `DegreePathWayProject_Scripts/check_data.mjs` validates these rules plus the coverage targets.
