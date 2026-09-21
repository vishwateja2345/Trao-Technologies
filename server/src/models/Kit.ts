import mongoose, { Schema, type HydratedDocument, type Model, type Types } from "mongoose";
import type {
  CompanyBrief,
  Coverage,
  Flashcard,
  GenerationStep,
  GenerationStatus,
  PracticeRecord,
  Question,
  Role,
  Schedule,
  KitSource,
} from "../types/kit.js";
import type { ResearchContext } from "../pipeline/generateKit.js";

const requirementSchema = new Schema(
  {
    id: { type: String, required: true },
    text: { type: String, required: true },
    kind: { type: String, enum: ["technical", "behavioural", "domain"], required: true },
    priority: { type: String, enum: ["must", "nice"], required: true },
  },
  { _id: false }
);

const questionSchema = new Schema(
  {
    id: { type: String, required: true },
    requirement_ids: { type: [String], default: [] },
    category: {
      type: String,
      enum: ["technical", "behavioural", "system-design", "company-fit"],
      required: true,
    },
    prompt: { type: String, required: true },
    answer_outline: { type: String, default: "" },
    difficulty: { type: Number, enum: [1, 2, 3], required: true },
    origin: { type: String, enum: ["generated", "edited", "user_added"], default: "generated" },
    pinned: { type: Boolean, default: false },
  },
  { _id: false }
);

const flashcardSchema = new Schema(
  {
    id: { type: String, required: true },
    front: { type: String, required: true },
    back: { type: String, required: true },
    requirement_ids: { type: [String], default: [] },
    origin: { type: String, enum: ["generated", "edited", "user_added"], default: "generated" },
    pinned: { type: Boolean, default: false },
  },
  { _id: false }
);

const scheduleDaySchema = new Schema(
  {
    day: { type: Number, required: true },
    focus: { type: String, default: "" },
    question_ids: { type: [String], default: [] },
    minutes: { type: Number, required: true },
  },
  { _id: false }
);

const generationStepSchema = new Schema(
  {
    name: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "running", "done", "skipped", "failed"],
      default: "pending",
    },
    detail: { type: String, default: "" },
    started_at: { type: String },
    finished_at: { type: String },
  },
  { _id: false }
);

const practiceRecordSchema = new Schema(
  {
    flashcard_id: { type: String, required: true },
    confidence: { type: Number, min: 1, max: 5, required: true },
    reviewed_at: { type: String, required: true },
  },
  { _id: false }
);

export interface KitFields {
  userId: Types.ObjectId;
  requestHash: string;
  input: { jd: string; company_url: string; days: number };
  status: GenerationStatus;
  generationSteps: GenerationStep[];
  failureReason: string | null;
  source: KitSource;
  company_brief: CompanyBrief;
  role: Role;
  questions: Question[];
  flashcards: Flashcard[];
  schedule: Schedule;
  coverage: Coverage;
  practiceRecords: PracticeRecord[];
  researchContext: ResearchContext;
  createdAt: Date;
  updatedAt: Date;
}

export type KitDoc = HydratedDocument<KitFields>;

const kitSchema = new Schema<KitFields>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    requestHash: { type: String, required: true, index: true },

    input: {
      jd: { type: String, required: true },
      company_url: { type: String, required: true },
      days: { type: Number, required: true },
    },

    status: {
      type: String,
      enum: ["pending", "researching", "generating", "ready", "partial", "failed"],
      default: "pending",
    },
    generationSteps: { type: [generationStepSchema], default: [] },
    failureReason: { type: String, default: null },

    source: {
      type: {
        company: { type: String, default: "" },
        company_url: { type: String, default: "" },
        role: { type: String, default: "" },
        location: { type: String, default: "" },
        jd_chars: { type: Number, default: 0 },
        researched_at: { type: String, default: "" },
        pages_used: { type: [String], default: [] },
      },
      default: () => ({}),
    },
    company_brief: {
      type: {
        summary: { type: String, default: "" },
        what_they_do: { type: String, default: "" },
        sources: { type: [String], default: [] },
        origin: { type: String, enum: ["generated", "edited", "user_added"], default: "generated" },
        pinned: { type: Boolean, default: false },
      },
      default: () => ({}),
    },
    role: {
      type: {
        title: { type: String, default: "" },
        seniority: { type: String, default: "" },
        responsibilities: { type: [String], default: [] },
        requirements: { type: [requirementSchema], default: [] },
      },
      default: () => ({}),
    },
    questions: { type: [questionSchema], default: [] },
    flashcards: { type: [flashcardSchema], default: [] },
    schedule: {
      type: {
        days_available: { type: Number, default: 0 },
        days: { type: [scheduleDaySchema], default: [] },
        origin: { type: String, enum: ["generated", "edited", "user_added"], default: "generated" },
        pinned: { type: Boolean, default: false },
      },
      default: () => ({}),
    },
    coverage: {
      type: {
        uncovered_requirement_ids: { type: [String], default: [] },
        passes: { type: Number, default: 0 },
      },
      default: () => ({}),
    },

    practiceRecords: { type: [practiceRecordSchema], default: [] },

    researchContext: {
      type: {
        hiringProcessNotes: { type: String, default: "" },
        hiringMentionsSystemDesign: { type: Boolean, default: false },
        seniorRole: { type: Boolean, default: false },
      },
      default: () => ({}),
    },
  },
  { timestamps: true }
);

// Same user submitting the same JD + company twice should reopen the
// existing kit rather than silently generating a duplicate.
kitSchema.index({ userId: 1, requestHash: 1 }, { unique: true });

export const Kit = mongoose.model<KitFields, Model<KitFields>>("Kit", kitSchema);
