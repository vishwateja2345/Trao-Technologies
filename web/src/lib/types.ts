/** Client-side mirror of server/src/types/kit.ts — kept in sync manually. */

export type RequirementKind = "technical" | "behavioural" | "domain";
export type RequirementPriority = "must" | "nice";
export type QuestionCategory = "technical" | "behavioural" | "system-design" | "company-fit";
export type ItemOrigin = "generated" | "edited" | "user_added";
export type GenerationStatus = "pending" | "researching" | "generating" | "ready" | "partial" | "failed";

export interface Requirement {
  id: string;
  text: string;
  kind: RequirementKind;
  priority: RequirementPriority;
}

export interface Question {
  id: string;
  requirement_ids: string[];
  category: QuestionCategory;
  prompt: string;
  answer_outline: string;
  difficulty: 1 | 2 | 3;
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

export interface CompanyBrief {
  summary: string;
  what_they_do: string;
  sources: string[];
  origin?: ItemOrigin;
  pinned?: boolean;
}

export interface KitSource {
  company: string;
  company_url: string;
  role: string;
  location: string;
  jd_chars: number;
  researched_at: string;
  pages_used: string[];
}

export interface Role {
  title: string;
  seniority: string;
  responsibilities: string[];
  requirements: Requirement[];
}

export interface GenerationStep {
  name: string;
  status: "pending" | "running" | "done" | "skipped" | "failed";
  detail?: string;
  finished_at?: string;
}

export interface PracticeRecord {
  flashcard_id: string;
  confidence: number;
  reviewed_at: string;
}

export interface Kit {
  id: string;
  status: GenerationStatus;
  failureReason: string | null;
  generationSteps: GenerationStep[];
  input: { jd: string; company_url: string; days: number };
  practiceRecords: PracticeRecord[];
  source: KitSource;
  company_brief: CompanyBrief;
  role: Role;
  questions: Question[];
  flashcards: Flashcard[];
  schedule: Schedule;
  coverage: { uncovered_requirement_ids: string[]; passes: number };
}

export interface KitSummary {
  id: string;
  status: GenerationStatus;
  company: string;
  role: string;
  days: number;
  uncovered: number;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PracticeQueueItem {
  flashcard_id: string;
  front: string;
  back: string;
  last_confidence: number | null;
  times_reviewed: number;
}

export interface WeakSpotEntry {
  requirement_id: string;
  text: string;
  priority: RequirementPriority;
  kind: RequirementKind;
  status: "gap" | "weak" | "unpracticed" | "solid";
  question_count: number;
  flashcard_count: number;
  avg_confidence: number | null;
}
