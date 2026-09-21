/**
 * Kit structure types — mirrors Appendix A of the assessment brief exactly.
 * Field names and nesting must not change. This file is the single source
 * of truth; the Mongoose schema and the Zod validator both derive from it
 * so the three can never quietly drift apart.
 *
 * Extra bookkeeping the app needs (edit/pin state, timestamps) lives in
 * sibling fields alongside the spec fields, not inside them, so a kit can
 * always be stripped down to exactly the Appendix A shape for the batch
 * output file.
 */

export type RequirementKind = "technical" | "behavioural" | "domain";
export type RequirementPriority = "must" | "nice";
export type QuestionCategory =
  | "technical"
  | "behavioural"
  | "system-design"
  | "company-fit";

/** Provenance of a single editable unit inside a kit. */
export type ItemOrigin = "generated" | "edited" | "user_added";

export interface KitSource {
  company: string;
  company_url: string;
  role: string;
  location: string;
  jd_chars: number;
  researched_at: string;
  pages_used: string[];
}

export interface CompanyBrief {
  summary: string;
  what_they_do: string;
  sources: string[];
  /** Bookkeeping (not in Appendix A but required to support safe regeneration) */
  origin?: ItemOrigin;
  pinned?: boolean;
}

export interface Requirement {
  id: string;
  text: string;
  kind: RequirementKind;
  priority: RequirementPriority;
}

export interface Role {
  title: string;
  seniority: string;
  responsibilities: string[];
  requirements: Requirement[];
}

export interface Question {
  id: string;
  requirement_ids: string[];
  category: QuestionCategory;
  prompt: string;
  answer_outline: string;
  difficulty: 1 | 2 | 3;
  /** Bookkeeping fields used to support edit/pin/regenerate semantics. */
  origin: ItemOrigin;
  pinned: boolean;
}

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  requirement_ids: string[];
  origin: ItemOrigin;
  pinned: boolean;
}

export interface ScheduleDay {
  day: number;
  focus: string;
  question_ids: string[];
  minutes: number;
}

export interface Schedule {
  days_available: number;
  days: ScheduleDay[];
  origin?: ItemOrigin;
  pinned?: boolean;
}

export interface Coverage {
  uncovered_requirement_ids: string[];
  passes: number;
}

export interface Kit {
  source: KitSource;
  company_brief: CompanyBrief;
  role: Role;
  questions: Question[];
  flashcards: Flashcard[];
  schedule: Schedule;
  coverage: Coverage;
}

/** Practice-mode tracking, stored alongside but outside the Appendix A shape. */
export interface PracticeRecord {
  flashcard_id: string;
  confidence: 1 | 2 | 3 | 4 | 5;
  reviewed_at: string;
}

export interface GenerationStep {
  name: string;
  status: "pending" | "running" | "done" | "skipped" | "failed";
  detail?: string;
  started_at?: string;
  finished_at?: string;
}

export type GenerationStatus =
  | "pending"
  | "researching"
  | "generating"
  | "ready"
  | "partial"
  | "failed";

/** Strips internal bookkeeping fields so a document matches Appendix A exactly. */
export function toAppendixAShape(kit: Kit): Kit {
  return {
    source: kit.source,
    company_brief: {
      summary: kit.company_brief.summary,
      what_they_do: kit.company_brief.what_they_do,
      sources: kit.company_brief.sources,
    },
    role: kit.role,
    questions: kit.questions.map((q) => ({
      id: q.id,
      requirement_ids: q.requirement_ids,
      category: q.category,
      prompt: q.prompt,
      answer_outline: q.answer_outline,
      difficulty: q.difficulty,
      origin: q.origin,
      pinned: q.pinned,
    })),
    flashcards: kit.flashcards.map((f) => ({
      id: f.id,
      front: f.front,
      back: f.back,
      requirement_ids: f.requirement_ids,
      origin: f.origin,
      pinned: f.pinned,
    })),
    schedule: {
      days_available: kit.schedule.days_available,
      days: kit.schedule.days,
    },
    coverage: kit.coverage,
  };
}
