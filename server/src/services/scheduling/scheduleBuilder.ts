import type { Question, QuestionCategory, Requirement, Schedule, ScheduleDay } from "../../types/kit.js";

/**
 * Deterministic day-by-day allocator (brief Section 8: "This is arithmetic
 * and allocation. It belongs in your code, not in a prompt."). No LLM call
 * happens here.
 *
 * Algorithm:
 *  1. Sort all questions so anything covering a must-have requirement comes
 *     first, then by difficulty descending — harder, higher-priority
 *     material is placed into earlier day-buckets, never saved for last.
 *  2. Greedily bin-pack questions into exactly `days_available` day buckets
 *     up to a per-day minute capacity derived from the total workload, so
 *     load is roughly balanced rather than front-loading everything onto
 *     day 1 for a normal multi-day case.
 *  3. If a day still has no assigned question after the first pass (this
 *     happens when days_available is larger than the amount of generated
 *     material — the 60-day edge case), fill it with a lighter spaced
 *     review session recycling a must-have question, so no day is empty
 *     and long horizons still get used productively.
 *  4. A 1-day request forces every question into day 1 by construction —
 *     the capacity check simply always finds day 1 as the only option.
 */

const MINUTES_BY_DIFFICULTY: Record<1 | 2 | 3, number> = { 1: 15, 2: 30, 3: 45 };
const MAX_DAYS = 120; // sane upper bound; documented in README as a deliberate clamp

const CATEGORY_LABELS: Record<QuestionCategory, string> = {
  technical: "Technical",
  behavioural: "Behavioural",
  "system-design": "System Design",
  "company-fit": "Company Fit",
};

interface DayBucket {
  minutes: number;
  questionIds: string[];
  categories: Set<QuestionCategory>;
  isReview: boolean;
}

function focusLabel(bucket: DayBucket): string {
  const labels = [...bucket.categories].map((c) => CATEGORY_LABELS[c]);
  const base = labels.length ? labels.join(" + ") : "General review";
  return bucket.isReview ? `Review: ${base}` : base;
}

export function buildSchedule(
  requirements: Requirement[],
  questions: Question[],
  requestedDays: number
): Schedule {
  const days_available = Math.min(MAX_DAYS, Math.max(1, Math.round(requestedDays) || 1));

  const mustIds = new Set(requirements.filter((r) => r.priority === "must").map((r) => r.id));
  const hasMust = (q: Question) => q.requirement_ids.some((id) => mustIds.has(id));

  const ordered = [...questions].sort((a, b) => {
    const am = hasMust(a) ? 1 : 0;
    const bm = hasMust(b) ? 1 : 0;
    if (am !== bm) return bm - am;
    if (b.difficulty !== a.difficulty) return b.difficulty - a.difficulty;
    return 0;
  });

  const totalMinutes = ordered.reduce((sum, q) => sum + MINUTES_BY_DIFFICULTY[q.difficulty], 0);
  const capacity = Math.max(30, Math.ceil(totalMinutes / days_available));

  const buckets: DayBucket[] = Array.from({ length: days_available }, () => ({
    minutes: 0,
    questionIds: [],
    categories: new Set<QuestionCategory>(),
    isReview: false,
  }));

  for (const q of ordered) {
    const duration = MINUTES_BY_DIFFICULTY[q.difficulty];
    let targetIndex = buckets.findIndex((b) => b.minutes + duration <= capacity * 1.2);
    if (targetIndex === -1) {
      targetIndex = buckets.reduce(
        (bestIdx, bucket, idx, arr) => (bucket.minutes < arr[bestIdx].minutes ? idx : bestIdx),
        0
      );
    }
    const bucket = buckets[targetIndex];
    bucket.minutes += duration;
    bucket.questionIds.push(q.id);
    bucket.categories.add(q.category);
  }

  // Long horizons (e.g. a 60-day request) will have empty trailing days once
  // all fresh material is placed — recycle must-have questions as spaced
  // review instead of leaving a day with nothing scheduled.
  const mustQuestions = ordered.filter(hasMust);
  let reviewCursor = 0;
  for (const bucket of buckets) {
    if (bucket.questionIds.length === 0 && mustQuestions.length > 0) {
      const q = mustQuestions[reviewCursor % mustQuestions.length];
      reviewCursor++;
      bucket.minutes = Math.max(15, Math.round(MINUTES_BY_DIFFICULTY[q.difficulty] * 0.5));
      bucket.questionIds.push(q.id);
      bucket.categories.add(q.category);
      bucket.isReview = true;
    }
  }

  const days: ScheduleDay[] = buckets.map((bucket, i) => ({
    day: i + 1,
    focus: focusLabel(bucket),
    question_ids: bucket.questionIds,
    minutes: Math.round(bucket.minutes),
  }));

  return { days_available, days };
}
