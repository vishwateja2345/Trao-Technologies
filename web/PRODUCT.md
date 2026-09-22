# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
*(Inferred from the original assessment brief — not confirmed by live interview; user was unavailable.)*
Job candidates preparing for a specific upcoming interview, typically within days, not weeks. They arrive with a real job posting and a real deadline (the "days until interview" they enter), not browsing casually. Primary situation: they have found a role, need to quickly understand the company and the role's real requirements, and need a concrete, working set of material (questions, flashcards, a day-by-day plan) rather than generic interview advice.

## Product Purpose
Turns a pasted job description and a company URL into a structured, editable interview-preparation kit: a company brief, a role/requirements breakdown, a categorised question bank, flashcards, and a day-by-day study schedule allocated across exactly the number of days the candidate has. The kit is a working document the candidate edits, regenerates piece by piece, and practises against — not a static report.

## Positioning
Most interview-prep tools either generate a generic question list from a job title, or require the candidate to manually research the company themselves. This product does the research itself — crawling the actual company site to find its real hiring process (not a hard-coded guess) and searching for public discussion of that company's interview process — then produces requirement-linked questions with a deterministic, auditable coverage check (every must-have requirement is guaranteed to have at least one question) and a deterministic day-by-day schedule (never left to a model's arithmetic).

## Operating Context
- Single-sitting workflow: paste JD → give company URL → wait through a visible multi-step generation (crawl, discussion search, brief, questions, coverage pass, flashcards, schedule) → land in an editable kit.
- Can also be run as a batch of many roles at once (file upload of JD+company+days triples), for someone interviewing at several companies in the same window.
- The kit is reopened and worked on over multiple days leading up to the interview — editing, reordering, regenerating one section, and doing timed practice sessions — not created once and abandoned.
- Practice sessions happen standalone, often the night before or morning of, ordered by the candidate's own recorded confidence so the weakest material surfaces first.

## Capabilities and Constraints
- Authentication is minimal by design (register/login/logout only — no email verification, password reset, or roles) since interview prep is time-boxed and disposable per job search.
- Every kit belongs to exactly one user; a duplicate JD+company submission reopens the existing kit rather than duplicating it.
- Generation is slow (crawls a real website, calls an LLM multiple times) and can partially fail (no hiring page found, thin JD, discussion search returns nothing) — these are reported honestly as "worth knowing" notes on the kit, not hidden or treated as fatal errors.
- Deterministic guarantees the interface must always honor: the schedule always spans exactly the requested number of days; a must-have requirement is never silently left uncovered without it being visibly flagged.
- Builder state model: every question/flashcard/brief/schedule section tracks whether it is `generated`, `edited`, or `user_added`, and whether it is `pinned` — regenerating one section must never discard edits made elsewhere, and a pinned/edited item must survive a regeneration of its own category.

## Brand Commitments
- Working name: "PrepKit" (from the current navbar wordmark). No externally-confirmed logo, color, or typography commitment exists yet — the current visual treatment is implementation-default Tailwind styling, not a deliberate brand decision, and is explicitly being replaced by this redesign.

## Evidence on Hand
No real customer testimonials, case studies, press, or brand assets exist. All UI copy in the current build is functional/placeholder in tone; no marketing claims should be invented.

## Product Principles
1. Honesty over polish in generated content: a thin job description or an unreachable company must produce a visibly thin, clearly-labeled result — never a confident-looking fabrication.
2. The user's own edits are sacred: no regeneration, refresh, or automated pass may silently discard something the candidate typed or pinned.
3. Time pressure is the primary emotional context: every screen should assume the visitor has a countdown running, not idle browsing time — clarity and speed of orientation beat decorative flourish.
4. Determinism is trustworthy, opacity is not: coverage and scheduling guarantees are structural, and the interface should make that legible (e.g. visible coverage gaps, visible day allocation) rather than hidden behind a black-box "AI did it" feeling.

## Accessibility & Inclusion
No user-specific accessibility requirement was confirmed. The original engineering brief for this build explicitly required keyboard navigability and clear loading/empty/error states as baseline technical requirements; treat WCAG AA as the working standard absent further guidance.
