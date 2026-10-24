# Degree Pathway Suggester

Hackathon proof of concept. New students answer a short questionnaire (goal, interests, background). The app finds alumni with similar profiles who reached the same goal and recommends a major, a minor and an 8-semester course plan. Every recommendation shows its evidence, for example "24 of 30 similar students who became a Data Analyst took DS 201, usually by term 4, compared with 27% of all alumni". Opted-in alumni and seniors appear as mentors with contact links.

**All data is synthetic** (fictional Ridgeview State University). Contact details use `example.com` and `linkedin.example.com`.

## Run locally

```bash
npm install
npm run dev        # http://localhost:3000
```

## Test

With the app running:

```bash
node scripts/test_api.mjs   # checks 41 generated plans: prereqs, seasons, credits, requirements, evidence, mentors
```

## Stack and layout

Next.js (App Router) + TypeScript + Tailwind. There is no database: the JSON "tables" in `data/` are loaded on the server.

| Path | Purpose |
|---|---|
| `data/` | Synthetic tables and `SCHEMA.md` |
| `src/contract/types.ts` | API contract shared by the frontend and the API |
| `src/lib/data.ts` | Loads and indexes the data (server only) |
| `src/lib/recommend.ts` | Matching, major/minor choice, plan scheduling, evidence, mentor ranking |
| `src/app/api/*` | `GET /api/options`, `POST /api/recommendations`, `GET /api/mentors` |
| `src/app/{questionnaire,plan,mentors}` | Screens |

## How recommendations work

1. **Similarity:** 0.5 × same goal + 0.3 × shared interests (Jaccard) + 0.2 × shared background (Jaccard).
2. **Evidence group:** the 30 most similar alumni who reached the student's goal.
3. **Major:** the major with the largest similarity-weighted share of that group, nudged by interest fit. **Minor:** the most common minor among group members in that major.
4. **Plan:** gen-eds, major core, popular electives, minor courses, and "strong signal" courses that the group took much more often than alumni overall. Each course is placed in the term similar students usually took it, respecting prerequisites, the semesters it is offered, and an 18-credit cap.

## Deploy

Import the repo in Vercel (framework preset: Next.js), or run `npx vercel --prod`. `next.config.ts` makes sure `data/*.json` ships with the API functions.
