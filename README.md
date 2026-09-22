# The AI Interview Prep Kit

Turns a pasted job description + a company website into a structured, editable
interview preparation kit: a company brief, a role/requirements breakdown, a
categorised question bank, flashcards, and a day-by-day study schedule — then
lets you reshape any of it and practise against it.

Built for the Trao "AI Interview Prep Kit" full-stack assessment (brief
`FS-AI-INTERVIEW-01`).

## 1. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js 16 (App Router) + Tailwind CSS v4 + TypeScript | Matches the preferred stack. React Query for server state/caching/polling, dnd-kit for accessible drag reordering. |
| Backend | Node.js + Express + TypeScript | Matches the preferred stack. Plain Express (no framework magic) keeps the retrieval/generation/scheduling/persistence layering explicit. |
| Database | MongoDB (Mongoose) | Matches the preferred stack. A kit's shape is a nested document, which maps naturally onto MongoDB rather than a normalised relational schema. |
| Scraping | Native `fetch` + `cheerio` + `robots-parser` | No headless browser needed — company marketing/careers pages are static HTML. cheerio gives jQuery-style DOM querying for link ranking. |
| LLM | **DeepSeek** (`deepseek-chat`) or **OpenRouter** (free-tier models), pluggable | One OpenAI-compatible client supports either; see §4 for why both are offered and the design of the pluggable client. |
| Tests | Vitest | Fast, native ESM/TS support, no extra config beyond `vitest.config.ts`. |

Everything is TypeScript. No other language/runtime is used.

## 2. Repository layout

```
server/                 Express API + pipeline + batch entry point
  src/
    config/             env loading + validation, DB connection
    models/             Mongoose schemas (User, Kit)
    middleware/          auth (JWT cookie), error envelope
    routes/              auth.ts, kits.ts (thin controllers)
    services/
      retrieval/          URL safety (SSRF guard), robots.txt, page fetch+clean, crawler, discussion search
      generation/          LLM client (DeepSeek + OpenRouter + mock), prompt-injection fencing, extraction, brief, questions, flashcards
      coverage/            deterministic coverage checker
      scheduling/          deterministic day-by-day allocator
      validation/          Zod schema mirroring Appendix A exactly
      research/            shared crawl+discussion step (reused by first pass and by "regenerate brief")
    pipeline/             generateKit.ts (full orchestration) + regenerateSection.ts
    scripts/evaluate.ts   the mandatory batch entry point
  tests/                 vitest suite
  fixtures/               local company-site server + sample cases.json for manual/batch testing
web/                    Next.js app (auth pages, dashboard, builder, practice mode)
render.yaml             Render deployment blueprint for the API
```

## 3. Setup

### Local development

Prerequisites: Node 18+, and either a local MongoDB (or Docker) or a free
MongoDB Atlas cluster.

```bash
git clone <your-repo-url>
cd ai-interview-prep-kit
npm install                       # installs both server/ and web/ workspaces

# Backend
cp server/.env.example server/.env
# start MongoDB locally, e.g.: docker run -d -p 27017:27017 mongo:7
npm run dev:server                # http://localhost:4000

# Frontend (separate terminal)
cp web/.env.example web/.env.local
npm run dev:web                   # http://localhost:3000
```

Visit `http://localhost:3000`, register an account, and create a kit. With no
LLM key set, `LLM_PROVIDER` defaults to `mock`: the full pipeline runs
end-to-end with deterministic, template-based content instead of real model
output, so you can exercise every feature (auth, crawling, coverage loop,
builder, practice mode, batch entry point) without any API key or network
cost. **Set `LLM_PROVIDER=deepseek` + `DEEPSEEK_API_KEY`, or
`LLM_PROVIDER=openrouter` + `OPENROUTER_API_KEY`** to get real generation
quality — this is what the deployed instance uses. Verified locally: a
real run against DeepSeek produces specific, non-generic questions (e.g. a
TypeScript-generics question for a "5+ years Node.js/TypeScript"
requirement, not a templated one) and a company brief that correctly
folds in the crawled hiring-process details.

### The batch entry point

```bash
cd server
npm run evaluate -- --input <cases.json> --output <kits.json>
```

This is a plain `tsx` script with **no MongoDB dependency at all** — it calls
the same `runPipeline()` function the HTTP API calls, reads cases, and writes
Appendix B-shaped output. It works from a clean clone with only `npm install`.

To try it against the included local fixture company sites:

```bash
cd server
npm install
node fixtures/company-sites-server.mjs &      # serves fake company pages on :8099
ALLOW_PRIVATE_HOSTS=true npm run evaluate -- --input fixtures/sample-cases.json --output /tmp/kits.json
```

`fixtures/sample-cases.json` includes five cases that deliberately exercise
the edge cases the brief calls out: a normal case, a company with no hiring
page anywhere on it, a two-line JD stub, an unreachable company URL, and a
1-day cram schedule. On this machine, all five complete in **~5–6 seconds**
in mock mode, and in **~38 seconds with real `LLM_PROVIDER=deepseek`
generation** (verified run, all 5 `ok`) — comfortably inside the 15-minute
budget with wide margin for a slower/more rate-limited provider.

`ALLOW_PRIVATE_HOSTS=true` is required only because the fixture server runs
on localhost — the SSRF guard blocks loopback/private addresses by default
(see §10). Real company URLs need no such flag.

### Deployed

- **Frontend:** deploy `web/` to Vercel (free tier). Import the repo, set the
  project's root directory to `web`, and set one env var: `API_URL` = your
  deployed API's URL (server-side only, used by `next.config.ts`'s rewrite —
  never exposed to the browser).
- **Backend:** deploy `server/` to Render (free tier) using the included
  `render.yaml` blueprint, or manually as a Node web service with root
  directory `server`, build command `npm install && npm run build`, start
  command `npm start`. Set the env vars listed in `server/.env.example`
  (`MONGODB_URI` from MongoDB Atlas's free tier, `OPENROUTER_API_KEY`,
  `CORS_ORIGIN` = your Vercel URL, a real `JWT_SECRET`).
- **Database:** a MongoDB Atlas free (M0) cluster, with network access
  allowing Render's egress (0.0.0.0/0 is simplest on a free-tier demo).

Live URLs: _fill in after deploying — see the submission checklist in this
README's final section._

## 4. LLM provider

**DeepSeek** (`deepseek-chat`) and **OpenRouter** (free-tier models, e.g.
`nvidia/nemotron-3-super-120b-a12b:free`) are both supported through one
`OpenAICompatibleClient`, since both speak the same OpenAI-style
`/chat/completions` shape — switch between them with `LLM_PROVIDER`
(`deepseek` | `openrouter` | `mock`). The deployed instance runs on
whichever of the two is configured in its environment; see
`server/.env.example` for both.

In practice, testing this end-to-end surfaced a real, brief-relevant
observation: OpenRouter's shared free-tier pool is frequently
"temporarily rate-limited upstream" for popular models (a plain `429`),
independent of anything this app does — exactly the failure mode Section
10 asks for a plan for. DeepSeek's API isn't a metered free tier (it needs
a small prepaid balance, effectively pennies per run) but is fast and
reliable, so it's offered as an equally-supported alternative rather than
forcing a single point of failure. Both paths go through the identical
retry/backoff/fallback logic below.

### Handling free-tier rate limits (tokens-per-minute, not just requests)

- Every LLM call goes through a single shared `Throttle` that enforces a
  minimum spacing (`LLM_MIN_INTERVAL_MS`, default 1.5s) between requests,
  regardless of how many pipeline steps fire concurrently.
- On `429`/`5xx`/timeout, `withRetry` backs off exponentially with jitter
  (`LLM_MAX_RETRIES`, default 4) — and **honours a `Retry-After` header
  when the provider sends one**, using that exact wait instead of guessing.
- If the model returns unparsable JSON, we send one corrective follow-up
  ("reply again with ONLY valid JSON…") before giving up on that call.
- If a call still fails after all of that (provider down, sustained rate
  limiting), the client **falls back to the same deterministic heuristic
  used by the mock provider** for that one step, rather than failing the
  whole kit. This is why the app can promise "the run completes" even under
  provider flakiness — see `openAICompatibleClient.ts`.

## 5. High-level architecture

```
 Browser (Next.js)
   │  same-origin /api/* (Next.js rewrite proxy → no CORS, cookie stays same-site)
   ▼
 Express API
   ├─ auth: register/login/logout, JWT in httpOnly cookie
   ├─ kits: create (single + batch), read, edit, reorder, regenerate, practice
   │        └─ kicks off generation in-process, polled by the frontend
   └─ pipeline (shared with the batch script):
        extract requirements → crawl company site → search discussion →
        generate brief → generate questions (per category) →
        deterministic coverage check → gap-fill pass(es) →
        generate flashcards → deterministic schedule → structural validation
   ▼
 MongoDB (one document per kit; Appendix A fields + edit/pin bookkeeping)
```

The **same `runPipeline()` function** backs both the HTTP flow
(`services/kitService.ts` wraps it with persistence + progress events) and
`scripts/evaluate.ts` (which calls it directly, no persistence at all) — the
brief requires the batch entry point to run "the same code your application
uses, not a parallel implementation," and this is how that's satisfied
structurally, not just by convention.

## 6. Retrieval approach

- **Sources used:** the company's own website (homepage + crawled
  hiring/about pages) and public discussion of the company's interview
  process via DuckDuckGo's keyless HTML search endpoint
  (`html.duckduckgo.com/html`), reading the result snippets shown on the
  results page itself (we don't crawl further into each hit, to keep the
  request budget small and predictable under rate limits).
- **Finding the hiring page without hard-coding paths:** the crawler fetches
  the homepage, extracts every outgoing link, and scores each one by how
  strongly its URL path *and* anchor text match hiring-related patterns
  (`careers`, `jobs`, `join the team`, `we're hiring`, `interview process`,
  `handbook`, an engineering blog, …) versus about/culture patterns. The
  highest-scoring candidates (up to `CRAWL_MAX_PAGES - 1`) are fetched.
  Known third-party ATS domains (Greenhouse, Lever, Ashby, …) are recognised
  even off-domain, since many companies host their careers page entirely
  off their main site.
- **Politeness:** `robots.txt` is fetched and honoured per-origin (cached 10
  minutes) before any page is retrieved; a shared per-crawl `Throttle`
  spaces out requests; a page that can't be retrieved is recorded as
  **skipped**, never fails the whole run.
- **Security (Section 11):** every URL — the company URL, every discovered
  link, every redirect target — passes through `assertSafeUrl()` first: only
  `http`/`https`, DNS-resolved and IP-checked (not just string-checked) to
  reject loopback/RFC1918/link-local addresses in production. Content-type
  is restricted to HTML, and the body is capped at `CRAWL_MAX_BYTES`
  (streamed, not just checked via `Content-Length`, so a server that lies
  about its length can't bypass the cap). `ALLOW_PRIVATE_HOSTS` exists
  *solely* so the batch entry point can reach a `localhost` fixture server
  per Section 9 — it does **not** re-open other private ranges.
- **Prompt-injection defence:** every piece of untrusted text (the pasted
  JD and every scraped page) is fenced with an explicit
  `<untrusted_source>` block and an instruction to treat it as data, never
  as instructions, before it's ever concatenated into a prompt
  (`promptSafety.ts`). This isn't a complete defence against a determined
  adversarial page, but it's the right default posture per Section 11.

## 7. Sequencing research and generation

The brief is explicit that this has to be a real sequence of steps that
react to what was actually found, not one prompt that returns everything.
Concretely, in order:

1. **`extractRequirements(jd)`** — pasted text needs no retrieval, so this
   runs first, independent of everything else. Produces the role title,
   seniority, responsibilities, and a list of `{id, text, kind, priority}`
   requirements. Priority (`must`/`nice`) is instructed to come strictly
   from the posting's own wording ("required"/"must have" vs "nice to
   have"/"bonus"), never from how important the model thinks a skill is —
   this is the main lever against inventing/upgrading requirements.
2. **`crawlCompanySite(companyUrl)`** — only meaningful once there's a site
   to crawl; produces cleaned page text plus which pages look like hiring
   pages.
3. **`searchInterviewDiscussion(companyName)`** — best-effort, runs after
   the crawl so it can use the crawled company name if the URL didn't yield
   one.
4. **`generateCompanyBrief(pages, …)`** — needs the crawled pages; this is
   the step that would have nothing to summarise before step 2 ran.
5. **Question generation, one LLM call per *category*** — technical,
   behavioural, system-design, company-fit each get their own system prompt
   and their own call, batching every requirement that maps to that
   category. A requirement's `kind` decides its category
   (`categoriesForRequirement`); a **technical, must-have** requirement also
   picks up a `system-design` question **only if** the hiring-page text or
   discussion snippets actually mention system design/architecture rounds —
   this is the concrete mechanism behind "a company that publishes a
   take-home then a system design round should produce a different kit."
   A requirement like "mentors junior engineers" is `behavioural` and never
   enters the same call as a `technical` "5+ years React" requirement.
6. **Deterministic coverage check** (`checkCoverage`, pure code, no model
   call) — finds every `must` requirement with zero questions referencing
   its id.
7. **Gap-filling pass(es)** — for each uncovered must-have, its
   category-appropriate generation call runs again, scoped to just the
   gaps, then coverage is re-checked. Capped at `MAX_COVERAGE_PASSES`
   (default **2**: an initial pass plus one gap-fill pass). Two passes is
   the smallest number that satisfies "the kit does not ship with uncovered
   must-have requirements" for the overwhelming majority of realistic JDs
   without unboundedly retrying against a model that may be persistently
   failing to produce a question for a genuinely awkward requirement; any
   remainder is reported honestly in `coverage.uncovered_requirement_ids`
   rather than papered over.
8. **`generateFlashcards(requirements)`** — one card per requirement.
9. **`buildSchedule(requirements, questions, days)`** — deterministic, no
   model call (§8 below).
10. **Structural validation** (`kitSchema.ts`, Zod) — the assembled kit is
    checked against Appendix A's exact shape, including that every
    `requirement_ids`/`question_ids` reference actually resolves, before it
    is ever persisted or returned.

## 8. Generated / edited / pinned state (the builder's hardest problem)

Every question and flashcard carries two bookkeeping fields alongside its
content: `origin: "generated" | "edited" | "user_added"` and
`pinned: boolean`. The company brief and schedule carry the same `origin`/
`pinned` pair at the section level.

- A freshly generated item starts as `generated`, unpinned.
- Editing any content field flips it to `edited` (a `user_added` item stays
  `user_added` — it's already fully the user's).
- Adding an item by hand creates it as `user_added` **and pinned by
  default**, since something you typed yourself should never silently
  vanish.
- **Regenerating a category** (`regenerateQuestionCategory`) keeps every
  question in that category whose `origin !== "generated"` or which is
  explicitly `pinned`, deletes the rest, and generates a fresh full set for
  every requirement mapped to that category. Edits made in *other*
  categories, or in the brief/schedule, are never touched — the mutation is
  scoped to exactly the one section requested.
- **Regenerating the brief/schedule** checks that section's own
  `origin`/`pinned` first: if it's been edited or pinned, the API returns
  `409 SECTION_LOCKED` unless the caller explicitly passes `force: true`
  (the UI prompts the user to confirm before doing that).

This directly satisfies "a question the user wrote or edited by hand must
survive a regeneration of its category" and "regenerating one section must
not discard edits made elsewhere" — verified in practice in the walkthrough
video and reproducible via `server/tests` fixtures.

## 9. Schedule allocation (deterministic, Section 8)

`buildSchedule()` takes zero LLM input:

1. Assign each question a fixed study duration from its difficulty
   (`15 / 30 / 45` minutes for difficulty `1 / 2 / 3`).
2. Sort all questions: anything covering a **must-have** requirement first,
   then by difficulty descending — so harder, higher-priority material
   lands in earlier day-buckets by construction, never "the night before."
3. Greedily bin-pack the sorted list into exactly `days_available` buckets
   up to a per-day capacity derived from total workload ÷ days (with 20%
   flex so a single large question doesn't force an extra day). This keeps
   load roughly balanced across a normal multi-day request while still
   respecting the priority ordering from step 2.
4. A **1-day** request has only one bucket, so everything lands there by
   construction — no special case needed.
5. A **60-day** (or otherwise oversized) request will run out of fresh
   material partway through; any day left with nothing assigned is filled
   with a lighter **spaced review** session recycling a must-have question
   (cycling through them), so long horizons stay productive instead of
   sitting empty. Requested days are clamped to a sane `[1, 120]` range.

Every `day.minutes` is computed as an integer; `schedule.days.length` always
equals the requested `days_available` exactly; every `question_ids` entry
is guaranteed (by construction — it comes from `kit.questions`) to
reference a real question, which the Zod validator also double-checks.

## 10. Edge cases (Section 10)

| Case | Behaviour |
|---|---|
| Company URL invalid/404/timeout | `fetchAndClean` throws a typed `FetchFailure`; the crawl step catches it, records a `skipped` entry, and the pipeline continues with an honest, source-less brief. Not a batch failure. |
| No discoverable hiring/about page | `hiringPageFound: false` is recorded as a warning; question categories simply don't get a system-design boost, and the brief says plainly that little was found. |
| Two-line JD stub | `extractRequirements` is instructed to return *fewer* items rather than invent plausible ones; the pipeline flags `thin: true` and surfaces a warning; a near-empty `requirements` array flows honestly through to a thin kit. |
| No public discussion at all | `searchInterviewDiscussion` returns `snippets: []`; recorded as a warning, never an error. |
| Model returns invalid JSON / incomplete kit | Up to 2 in-conversation repair retries, then network retries, then a heuristic fallback (§4) — the step never throws past the pipeline; final assembled kit still passes Zod structural validation before being saved. |
| Provider rate-limits / briefly fails | Exponential backoff + `Retry-After` honouring (§4); heuristic fallback as the last resort. |
| Same description + company submitted twice | `computeRequestHash(userId, jd, companyUrl)` is a unique index on the Kit collection; a duplicate submission reopens the existing kit (`reused: true`) instead of generating again. |
| 1-day / 60-day schedule request | Handled deterministically, see §9. |

## 11. Security (Section 11)

- SSRF guard on every fetched URL (`urlSafety.ts`) — protocol allow-list,
  DNS-resolved private/loopback IP blocking, tested in
  `tests/urlSafety.test.ts`.
- Content-type restricted to HTML; body size streamed and capped.
- Untrusted content (JD + scraped pages) is fenced and explicitly
  instructed to be treated as data, never instructions, in every prompt.
- Passwords hashed with bcrypt; sessions are JWTs in an `httpOnly`,
  `sameSite=lax` cookie (`secure` in production); expired/invalid tokens
  return a clean `401 SESSION_EXPIRED`, never a crash.
- Per-user data isolation: every kit query is scoped to
  `{ _id, userId: req.user.userId }` — there is no endpoint that can read or
  modify another user's kit.
- Rate limiting on `/api/auth/*` (30 req/15 min) and `/api/kits/*`
  (120 req/min) via `express-rate-limit`.

## 12. Backend robustness notes

- Generation runs as a **fire-and-forget in-process job** kicked off by the
  create-kit route; the frontend polls `GET /api/kits/:id` and renders
  `generationSteps` as they land. This is a deliberate, documented trade-off
  for this assessment's scope: there's no persistent job queue, so a server
  restart mid-generation loses that one in-flight job (the kit is left in
  `generating` status; the user can delete and recreate it). A production
  version would move this to a durable queue (BullMQ/Redis or similar).
- Triggering the same JD+company twice is handled by the unique
  `(userId, requestHash)` index, not by client-side debouncing alone.
- Every write route validates its body with Zod before touching the
  database; the assembled kit is validated against the Appendix A Zod
  schema before being persisted.

## 13. Creative feature: Weak Spots Report

**Problem it solves:** coverage tells you a requirement *has* a question.
It says nothing about whether *you* have actually practised it, or how it
went. Two people with an identical kit can be in very different shape the
night before — one has drilled every hard question, the other has only
skimmed the easy ones. The builder's coverage badge and the practice mode's
per-card confidence are both real signals, but they live in different tabs
and nobody was combining them into "what do I actually need to look at
next."

**What it does:** a fully deterministic (no LLM call) rollup,
`buildWeakSpotsReport()`, that joins per-requirement: whether it's an
uncovered coverage gap, how many questions/flashcards exist for it, and the
user's own most recent practice confidence on its linked flashcards — into
one ranked list (`gap` → `weak` → `unpracticed` → `solid`), must-haves
ordered ahead of nice-to-haves within each band. It's exposed as a tab in
Practice mode with a "Print / save as PDF" button (a print stylesheet hides
navigation and produces a clean one-pager) — so the day before the
interview, there's a single ranked page to walk through, and it prints
cleanly if you'd rather not have your laptop open in the waiting room.

## 14. Key design decisions & trade-offs

- **In-process generation job, not a queue** — simplest thing that satisfies
  "watch the kit being generated, with visible progress," at the cost of
  durability across restarts (documented above).
- **One LLM call per question category, batched across its requirements** —
  a middle ground between "one call per requirement" (too slow/expensive
  for the 5-cases/15-minutes batch budget on a free-tier model) and "one
  call for everything" (which the brief explicitly rules out).
- **Mock LLM provider as the default** — lets the entire pipeline, builder,
  and batch entry point be built, tested, and demoed with zero API key and
  zero network flakiness; real generation quality requires setting
  `LLM_PROVIDER=deepseek` or `openrouter` with a real key, which is what the
  deployed instance and the final batch run use.
- **Supporting two LLM providers behind one client**, not just OpenRouter —
  during development, OpenRouter's shared free-tier pool returned `429
  temporarily rate-limited upstream` for every popular free model under
  real testing, independent of this app's own throttling. Rather than
  block on that, `OpenAICompatibleClient` is parameterised so DeepSeek
  (cheap, fast, reliable — not a metered free tier, but a few cents of
  prepaid balance) is an equally-supported path. Both exercise identical
  retry/backoff/repair/fallback logic; this is a direct, evidence-based
  response to the brief's warning that "a pipeline that falls over the
  first time a provider says 'slow down' is the most common way to lose
  points here."
- **Confidence-weighted practice ordering, not spaced-repetition intervals**
  — simpler to reason about and to test, and the brief explicitly allows
  it; a card never reviewed is treated as needing attention *before* a card
  you've rated low once, so first-pass breadth across the whole deck isn't
  crowded out by endlessly re-drilling a handful of already-seen weak
  cards.
- **DuckDuckGo HTML search for public discussion**, not a paid search API —
  keyless and free, at the cost of being screen-scraped and therefore more
  fragile than a real search API; failures degrade to "no discussion found"
  rather than breaking the run.

## 15. Known limitations

- No durable job queue for generation (see §12).
- Public discussion search depends on an unofficial, keyless endpoint that
  could change or rate-limit independently of OpenRouter.
- The mock LLM provider's heuristic text is intentionally plain — it exists
  for offline development/testing, not to represent final output quality.
- Requirements themselves aren't directly editable in the builder UI (only
  questions/flashcards/brief/schedule are, per the brief's explicit list in
  Section 6); adding a rewritten requirement would currently need to go
  through a new kit.

## 16. Tests

```bash
cd server
npm test
```

Covers the three areas the brief calls out as "most worth protecting" plus
the retrieval layer and the creative feature:
`scheduleBuilder.test.ts` (allocation), `coverageCheck.test.ts` (gap
detection), `kitSchema.test.ts` (Appendix A structural validation),
`urlSafety.test.ts` (SSRF guard), `crawler.test.ts` (hiring-page discovery
against a local fixture server, no hard-coded paths), and
`weakSpots.test.ts` (the creative feature's ranking logic).
