# Spotters.com

**Learn. Identify. Diagnose.**

A radiology education and assessment platform. This repository is built in
phases; medical case content is added manually later and is never invented
or seeded by the build process.

## Current status: Phases 1–11 written (see "Phases 7–11" below)

Phase 6 (Test Results and Review) is a natural extension of the Test system
and is included below, since a test flow isn't really testable without its
results page.

## Stack
- **Frontend:** React + Vite + Tailwind CSS
- **Backend:** Node.js + Express
- **Database:** MySQL
- **Auth:** bcrypt password hashing + JWT in an httpOnly cookie, protected routes

## Project structure
```
spotters/
├── client/           React + Vite frontend
├── server/           Express backend (config, controllers, routes, middleware, models)
├── database/         schema.sql (full schema) + seed.sql (structural data only)
├── .env.example       Template — copy to server/.env
└── README.md
```

## Prerequisites
- Node.js 18+
- MySQL 8+ running locally (or reachable)

## Setup

### 1. Install dependencies
```bash
npm run install:all
# or manually:
cd server && npm install
cd ../client && npm install
```

### 2. Configure environment
```bash
cp .env.example server/.env
```
Edit `server/.env` and set your real `DB_PASSWORD` and a strong `JWT_SECRET`
(e.g. `openssl rand -hex 32`).

### 3. Create the database
```bash
mysql -u root -p < database/schema.sql
mysql -u root -p < database/seed.sql
```
This creates the `spotters_db` database, all tables, the 11 fixed radiology
systems, and 4 empty test block shells. **No case content, images, or
questions are seeded** — that's intentional, per the project's content rules.

### 4. Seed the demo student account
```bash
cd server
node scripts/seedDemoUser.js
```
This prints demo login credentials to the console (also listed below).

### 5. Run the app
In two terminals:
```bash
# Terminal 1
cd server && npm run dev      # http://localhost:5000

# Terminal 2
cd client && npm run dev      # http://localhost:5173
```
Open http://localhost:5173.

## Demo login credentials
```
Email:    demo@spotters.com
Password: Demo@1234
```

## What's implemented in Phase 1
- Full project scaffold (client / server / database, cleanly separated)
- Complete normalized MySQL schema for **all** future phases (users, systems,
  practice_cases, case_images, tests, test_questions, test_attempts,
  test_answers, bookmarks, case_videos, ai_interactions) — so later phases
  don't require schema churn
- Structural seed data only: the 11 fixed system names, 4 empty test block
  shells, and (via script) one demo student account
- Registration (full name, email, password, confirm password) with
  server-side validation
- Secure password hashing with bcrypt (12 salt rounds)
- Login issuing a JWT stored in an httpOnly, sameSite cookie
- Logout (clears the cookie)
- `GET /api/auth/me` + a `requireAuth` middleware protecting private routes
- A minimal placeholder landing page, Register/Login pages, and a protected
  Dashboard page that greets the logged-in user by their **actual** name
  (never hard-coded) and redirects unauthenticated visitors to `/login`
- `.env.example` with all required environment variables; secrets are never
  exposed to the frontend

## How to test
1. Visit `http://localhost:5173` → click **Get Started** → register a new
   account → you should land on `/dashboard` and see your name, five stat
   cards all showing `0`/`—`, "No cases available yet.", and "No tests
   completed yet." (this is correct — no data exists yet).
2. Confirm the sidebar links (Practice, Tests, Progress, Navigation AI,
   Profile) all load without errors.
3. Log out → try visiting `/dashboard` directly → you should be redirected
   to `/login` (protected routes work).
4. Log back in with the demo credentials above.
5. `curl http://localhost:5000/api/health` should return a JSON success
   message confirming the API is running.
6. `curl http://localhost:5000/api/systems` (with an auth cookie) should
   return all 11 systems with `case_count: 0`.
7. Click into any system from `/practice` → you should see "No cases
   available yet." / "Cases for this system will be added soon."
8. Insert one test row into `practice_cases` with `status='published'`
   (see "Adding your own cases" below) → refresh `/practice/<slug>` → the
   case card should appear; opening it should show the image viewer
   (placeholder, until you add a `case_images` row) with zoom/reset/
   fullscreen controls working, and the bookmark button should toggle.

## What's implemented in Phase 2
- Full public landing page at `/`, composed of independent sections in
  `client/src/components/landing/`: `Navbar`, `Hero`, `HowItWorks`,
  `Features`, `WhySpotters`, `UserTypes`, `Footer`
- Hero headline/subhead/CTAs exactly per spec, plus a signature visual — a
  mock diagnostic viewer (`ScanFrame.jsx`) with corner brackets, a sweeping
  scan line, and a HUD-style data strip, echoing the actual product
  interaction (image → typed diagnosis) instead of a generic stat block
- The 4-step workflow (01 Practice → 02 Test → 03 Progress → 04 Navigation AI)
- 8 feature cards, the "Why Spotters.com?" pillar equation, and a
  Students/Doctors section that clearly marks the Doctor/Contributor portal
  as "Coming soon"
- Medical disclaimer in the footer
- A small hand-rolled SVG icon set (`components/icons.jsx`) — no external
  icon package dependency
- Type system: Space Grotesk (display), Inter (body), IBM Plex Mono (HUD/data
  labels), loaded via Google Fonts in `index.html`
- Fully responsive (mobile → desktop), reduced/purposeful motion (one hero
  fade-in, one looping scan line, no scattered effects)

## What's implemented in Phase 3
- **`GET /api/systems`** — all 11 systems with a live published-case count per
  system (0 until you add cases)
- **`GET /api/dashboard`** — real aggregate stats for the logged-in student,
  computed from `test_attempts`, `test_answers`, and `bookmarks`: Tests
  Completed, Questions Attempted, Overall Accuracy, Best Score, Bookmarked
  Cases, plus the 5 most recent completed tests. Every value is a genuine
  `0`/`—`/empty array when there's no activity — nothing is invented.
- Full **Student Dashboard** UI:
  - Header greets the logged-in user by their real name (never hard-coded)
  - 5 stat cards wired to the live values above
  - **Continue Learning** — a system grid pulling from `/api/systems`; shows
    "No cases available yet." per system until you add cases
  - **Recent Test Performance** — shows "No tests completed yet." until a
    test is completed
- A shared **`DashboardLayout`** (sidebar: Dashboard, Practice, Tests,
  Progress, Navigation AI, Profile, Logout) that every future student page
  reuses, so Phases 4–8 slot straight into the existing shell
- Lightweight placeholder pages for Practice, Tests, Progress, Navigation AI,
  and a functional Profile page, so dashboard links never dead-end while
  those phases are pending
- `/practice/:slug` route stub (system detail page), ready to become the
  real Practice case list in Phase 4

## What's implemented in Phase 4
- **`GET /api/practice/systems/:slug/cases`** — published cases for one
  system, each with a thumbnail (first image, if any) and this user's
  bookmark status. Returns `[]` until you add cases.
- **`GET /api/practice/cases/:id`** — full case detail: clinical info,
  diagnosis/explanation, key findings, learning points, differential
  diagnosis, all images, and bookmark status. Returns 404 until the case
  exists and is published.
- **`POST /api/bookmarks/:caseId`** / **`DELETE /api/bookmarks/:caseId`** —
  toggle a bookmark. **`GET /api/bookmarks`** — a student's bookmarked cases
  (used now for the case card/detail bookmark button; the full Bookmarks
  page is built in Phase 7).
- **Practice page** (`/practice`) — grid of all 11 systems with live case
  counts.
- **Practice System page** (`/practice/:slug`) — case cards (thumbnail,
  title, modality, difficulty, bookmark). Shows the required empty state
  exactly: *"No cases available yet." / "Cases for this system will be
  added soon."* until cases are added.
- **Practice Case page** (`/practice/:slug/:caseId`) — the full case
  experience:
  - A dark, professional image viewer (`ImageViewer.jsx`) with **Zoom in /
    Zoom out / Reset / Fullscreen**, built to support multiple images per
    case with thumbnail navigation. Shows the "Radiology Image" placeholder
    when no image exists yet.
  - Sections for **Case**, **Diagnosis**, **Key Imaging Findings**,
    **Learning Points**, and **Differential Diagnosis** — each pulling
    directly from the database, with a placeholder ("Case information will
    appear here." / "Diagnosis will appear after submission.") when a field
    is empty.
  - A bookmark toggle button.

### Important: adding your own cases
Case content is added directly to the `practice_cases` table (a Doctor/
Contributor upload UI is a future phase). **Set `status = 'published'`** on
any row you want visible in Practice — `draft`/`pending_review`/`approved`
rows exist for the future review workflow (see Phase 29 in the original
spec) but won't appear to students yet. Add rows to `case_images` (with the
matching `case_id`) for the image(s) a case should show.

## What's implemented in Phase 5
Tests are a completely separate structure from Practice: a **Block** mixes
questions from any system, each question is a `practice_case` referenced by
`test_questions`, and grading happens **only server-side** — correct answers
are never sent to the frontend before results.

- **`GET /api/tests`** — all blocks with a live question count and an
  `is_ready` flag (`true` only once a block has its full 20 questions
  attached and is active). Not-ready blocks show "Coming Soon" /
  "Questions not available yet." exactly per spec.
- **`POST /api/tests/:testId/start`** — creates a `test_attempts` row,
  auto-abandons any prior in-progress attempt for that block, and returns
  the 20 questions with **safe fields only** (no `correct_answer`,
  `explanation`, etc.).
- **`POST /api/tests/attempts/:attemptId/answers`** — saves one answer,
  evaluated server-side via `services/answerEvaluationService.js`
  (normalized exact-match; isolated so it can be swapped for smarter/AI
  matching later without touching the test flow). Ownership and
  `in_progress` status are checked on every call.
- **`POST /api/tests/attempts/:attemptId/complete`** — finalizes the
  attempt: computes score/accuracy from real saved answers, sets `status =
  'completed'`.
- **`GET /api/tests/attempts/:attemptId/results`** — the only endpoint that
  ever returns correct answers/explanations, and only for an attempt the
  requesting user owns and has completed.
- **Test List page** (`/tests`) — block cards showing questions/minutes/
  seconds-per-question, `[Start Test]` when ready, "Coming Soon" otherwise.
- **Test Interface** (`/tests/:testId/take`) — a focused, full-bleed exam
  screen (no sidebar): top bar with block/question count/live timer, the
  same dark image viewer from Practice, a case vignette, and a diagnosis
  text box. The 60-second timer **auto-saves and advances** on expiry;
  submitting manually does the same immediately. Question 20 stops the
  timer completely, finalizes the attempt, and redirects to Results —
  never starting another countdown. `Previous`/`Next` let a student review
  already-answered questions (read-only) without being able to edit a
  submitted answer; `Return to Current Question` jumps back to the live
  question.
- **Test Results page** (`/tests/attempts/:attemptId/results`) — "BLOCK X
  COMPLETE", score, accuracy, correct/incorrect counts, then a full
  question-by-question review (✓/✗, the student's answer, the correct
  answer, and the explanation) sourced entirely from the database.

### Seeding a full test block
A block only becomes startable once it has exactly `total_questions` (20)
rows in `test_questions`. Example, using the sample case from Phase 4:

```sql
INSERT INTO test_questions (test_id, case_id, question_order)
VALUES (1, <your_case_id>, 1);
-- repeat for question_order 2..20, mixing case_ids from any system
```

Until a block has all 20 slots filled, it correctly shows "Coming Soon."

## What's intentionally NOT in Phase 5
- The real Progress section, including system-wise performance, test
  history, and the full Bookmarks list page — Phase 7
- Navigation AI (currently a "coming soon" placeholder) — Phase 8
- Any radiology case content or test questions whatsoever — added manually
  by you, always

---

Waiting for your confirmation before starting **Phase 7 (Progress and
bookmarks)**.


## Phases 7–11 (Progress, Navigation AI, Voice, Video, Polish)

**Verification note:** these phases were syntax-checked only; run the app and walk through every page before relying on it.

- **Progress** — `GET /api/progress` and `/progress`: overview cards, system-wise accuracy bars, test history, bookmarked cases. Dashboard uses the same aggregates. Ungraded answers are excluded from accuracy.
- **Navigation AI** — `/navigation-ai` (library of published cases that have an answer key) and `/navigation-ai/:caseId`. Feedback comes from `server/services/aiService.js`. With no `AI_PROVIDER` set it runs the **demo provider**, which grades against the stored answer and shows only text you wrote in the case (explanation, key findings, learning points, differentials). To add a real model, register a provider in that file and set `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL` in `server/.env`.
- **Answer keys** — `correct_answer` may list alternatives separated by `|` (e.g. `Glioblastoma | GBM`). Matching ignores case and punctuation.
- **Voice** — mic button uses the browser Web Speech API (Chrome/Edge/Safari); hidden where unsupported.
- **Video** — add rows to `case_videos` (YouTube/Vimeo links or direct video URLs). Without rows: "Video explanation not available yet."
- **Case management API** (role `admin`/`doctor`) — `/api/admin/*`: create/edit cases, images, videos, status workflow (draft → pending_review → approved → published), assign test questions.
  - Create an admin: `node server/scripts/createAdmin.js "Name" email 'password' admin`
  - Bulk import your own cases: fill `database/cases.template.json`, then `node server/scripts/importCases.js path/to/file.json` (imports as drafts).
  - Local images: put files in `server/uploads/cases/` and use `/uploads/cases/<file>` as the image URL. Cloud storage later only changes the stored URLs.
- **Existing database?** run `database/migrations/002_phase7-11.sql`.
- **Polish** — mobile bottom nav, disclaimer footer, 404 page, error boundary, 401 redirect, simple in-memory rate limits on login/register and Navigation AI.

### Known gaps
No `helmet`, no shared-store rate limiting, no image-upload endpoint, no Doctor portal UI, real AI provider not implemented. See `PROJECT_HANDOVER.md` if present.

## Real images, content management, and Gemini (post-Phase 11)

**Install the new dependency and restart**
```bash
cd server && npm install        # adds multer
npm run dev
```
No database migration is needed for these features.

**Images:** open `/admin/cases` as an `admin`/`doctor` user (create one with `node scripts/createAdmin.js "Name" email 'password' admin`). Select a case → *Upload images* (JPEG/PNG/WebP, ≤10 MB each, ≤10 at once). Files go to `server/uploads/cases/` under random names and are linked via `case_images`. API: `POST /api/admin/cases/:id/images/upload` (multipart field `images`). A case must be `published` (answer key + ≥1 image) to appear to students.

**Test images:** test questions reuse the images of the practice case they reference — no duplication. Assign published cases to blocks in the *Test Blocks* panel (admin only).

**Gemini for Navigation AI** — in `server/.env`:
```
AI_PROVIDER=gemini
AI_API_KEY=<your key from Google AI Studio>
AI_MODEL=gemini-2.5-flash
```
Restart the server; the startup log prints `[ai] provider=gemini model=… key=set` (never the key). Run `cd server && node scripts/checkAi.js` for a one-request smoke test (uses a clearly artificial placeholder record). The app still decides correct/incorrect from your answer key; Gemini only writes short feedback grounded in the case record. If the AI call fails or times out, students see stored-case feedback with a clear "AI unavailable — not generated by AI" notice.
