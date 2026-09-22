# Design

<!-- impeccable:design-schema 1 -->

## World

**Countdown Board** — the app is styled as a split-flap departure-board
terminal: the study schedule is rendered as a literal timetable, status is
shown as gate-indicator plates, and every real data value (day numbers,
requirement/question ids, minutes, difficulty, timestamps) reads in a
monospace "flap character" face. This is a well-lit operations desk at
daytime, not a moody night-club dark-mode terminal — warm paper/bone
casing, not near-black-plus-neon.

**Why this world:** the product's own mechanism is a countdown against a
real deadline ("days until interview") with deterministic guarantees
(exact day allocation, checked coverage) — a departure board is the same
mechanism in the physical world: a precise, auditable schedule that must
never silently drop a stop. The audience (software engineers cramming for
a specific interview) also lives inside exam-prep/technical-tool
aesthetics daily; a board reads as competent and time-pressured without
borrowing the generic "AI SaaS dashboard" look.

**Explicitly avoided:** the three AI-default clusters named in this
skill's calibration guidance — warm-cream/serif/terracotta, near-black
dark-mode-plus-neon-glow, and editorial-hairline/italic-serif/mono-label.
This world differentiates via a *light*, warm-paper base (not dark), a
burnt-amber accent (not neon, not terracotta), a grotesk+mono pairing (no
serif display face at all), and hard-edged "plate" shadows/composition
(no soft blur/glow anywhere).

## Palette

Restrained strategy: neutrals plus one accent.

| Token | Hex | Use |
|---|---|---|
| `--board` | `#F2ECDC` | Page background — warm bone, the board's casing |
| `--panel` | `#FBF8F1` | Card/module surface — lighter than board, like a flap face |
| `--panel-recessed` | `#ECE3CD` | Recessed surfaces (inputs' focus bg, tab strips) |
| `--ink` | `#221D15` | Primary text — warm near-black, never cool/blue-black |
| `--ink-muted` | `#6D6353` | Secondary text — tinted from ink's own hue, never plain gray |
| `--ink-faint` | `#A89D87` | Tertiary/placeholder text, disabled state |
| `--rule` / `--rule-strong` | `#DCCFAB` / `#C2B28A` | Borders, dividers, module seams |
| `--amber` | `#A05414` | The one accent — tuned for 4.5:1+ against both board and panel |
| `--amber-strong` | `#8A4A12` | Hover/active accent, on-tint text |
| `--amber-tint` | `#F3E2C4` | Accent-tinted badge/chip backgrounds |
| `--signal-ok` / `--signal-ok-tint` | `#3F6B52` / `#DDE8DE` | "Solid" / ready status |
| `--signal-danger` / `--signal-danger-tint` | `#963C2C` / `#F4DDD4` | Errors, gaps, delete |

## Typography

- **Display/body:** Archivo — a geometric grotesk with a signage/wayfinding
  lineage. Used for every heading, body copy, prose badge, and button
  label (never uppercased or forced into a code register).
- **Mono:** JetBrains Mono — reserved strictly for real data and codes:
  schedule day numbers, requirement/question ids (`r1`, `q3`), difficulty
  and minute counts, status plates (`READY`, `PARTIAL`, `MUST`), nav
  labels, character/day counters. Never used as a "technical" costume over
  ordinary prose — a linked requirement's own sentence, for example,
  renders in Archivo (`Badge prose` variant) specifically to avoid that.
- Headings: tight tracking (`tracking-tight`). Mono labels: `uppercase
  tracking-wider` — read as engraved plate text, the opposite register
  from headings.

## Composition

- **Flap panels:** `Card` — rectangular (6px radius), 1px `--rule` border,
  hard 3px offset shadow with zero blur (a "plate," not a floating
  card-with-glow). The `seam` prop adds the horizontal split-flap divider
  used on components that read as literal board readouts (schedule days,
  flashcards, practice's flip card).
- **Status plates:** `Badge` — rectangular chips, 1px border in the
  status's own color family, mono/uppercase/tracked text. A `prose` escape
  hatch switches to Archivo/normal-case for badges carrying real freeform
  content (a linked requirement's own text) rather than a status code.
- **Buttons:** rectangular, hard offset shadow that collapses and the
  button nudges down on press/active — a physical switch, not a soft pill.
- **Kit list:** a bordered row-list (`KitCard` inside a shared `divide-y`
  container) read left-to-right like a timetable line — status plate,
  role@company, days remaining, actions — not a grid of same-size
  icon+heading+text cards.
- **Schedule (the hero surface):** each day is a literal timetable row —
  `DAY 01 · Technical · 75 MIN` — with its question manifest listed below
  a flap-seam divider.

## Motion

One authored signature moment, reused consistently rather than scattered:
the **flap-flip** (`@keyframes flap-flip`, a `rotateX` settle with slight
overshoot, ~380ms, `cubic-bezier(0.16,1,0.3,1)`). Applied to:

1. Revealing a flashcard's answer in Practice mode (the literal "flip" of
   a card).
2. Switching tabs inside a kit's detail view (brief/requirements/
   questions/flashcards/schedule).
3. The three-dot loading indicator (`Spinner`, `GenerationProgress`) —
   small flap characters resolving in a staggered loop.

Respects `prefers-reduced-motion: reduce` (the keyframe is disabled
entirely, not just shortened).

## Accessibility

- Every text/background pairing checked against WCAG AA (4.5:1 body,
  3:1 large text) — the accent amber was tuned from an initial `#AD5F18`
  to `#A05414` specifically because the original failed 4.5:1 for panel
  text on an amber background (4.47:1 measured); the tuned value clears
  it (5.25:1+) with margin.
- Focus-visible ring on every interactive element (`:focus-visible`,
  amber outline, never suppressed).
- All form fields have programmatically associated `<label htmlFor>` /
  `id` pairs (a prior gap — flashcard front/back labels were plain text
  with no `htmlFor` — was fixed as part of this build).
