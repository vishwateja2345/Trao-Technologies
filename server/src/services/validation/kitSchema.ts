import { z } from "zod";

/**
 * Runtime validator for the Appendix A kit shape. This is what "validate a
 * generated kit against the expected structure before saving it" means in
 * practice: every LLM output and every batch result is run through this
 * before it is trusted. Anything that fails is a bug or a bad model output,
 * never a silent pass-through.
 */

const requirementKind = z.enum(["technical", "behavioural", "domain"]);
const requirementPriority = z.enum(["must", "nice"]);
const questionCategory = z.enum([
  "technical",
  "behavioural",
  "system-design",
  "company-fit",
]);
const itemOrigin = z.enum(["generated", "edited", "user_added"]);

export const requirementSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  kind: requirementKind,
  priority: requirementPriority,
});

export const questionSchema = z.object({
  id: z.string().min(1),
  requirement_ids: z.array(z.string()),
  category: questionCategory,
  prompt: z.string().min(1),
  answer_outline: z.string(),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  origin: itemOrigin.default("generated"),
  pinned: z.boolean().default(false),
});

export const flashcardSchema = z.object({
  id: z.string().min(1),
  front: z.string().min(1),
  back: z.string().min(1),
  requirement_ids: z.array(z.string()),
  origin: itemOrigin.default("generated"),
  pinned: z.boolean().default(false),
});

export const scheduleDaySchema = z.object({
  day: z.number().int().positive(),
  focus: z.string(),
  question_ids: z.array(z.string()),
  minutes: z.number().int().nonnegative(),
});

export const scheduleSchema = z.object({
  days_available: z.number().int().positive(),
  days: z.array(scheduleDaySchema),
});

export const coverageSchema = z.object({
  uncovered_requirement_ids: z.array(z.string()),
  passes: z.number().int().nonnegative(),
});

export const kitSourceSchema = z.object({
  company: z.string(),
  company_url: z.string(),
  role: z.string(),
  location: z.string(),
  jd_chars: z.number().int().nonnegative(),
  researched_at: z.string(),
  pages_used: z.array(z.string()),
});

export const companyBriefSchema = z.object({
  summary: z.string(),
  what_they_do: z.string(),
  sources: z.array(z.string()),
});

export const roleSchema = z.object({
  title: z.string(),
  seniority: z.string(),
  responsibilities: z.array(z.string()),
  requirements: z.array(requirementSchema),
});

export const kitSchema = z
  .object({
    source: kitSourceSchema,
    company_brief: companyBriefSchema,
    role: roleSchema,
    questions: z.array(questionSchema),
    flashcards: z.array(flashcardSchema),
    schedule: scheduleSchema,
    coverage: coverageSchema,
  })
  .superRefine((kit, ctx) => {
    const requirementIds = new Set(kit.role.requirements.map((r) => r.id));
    const questionIds = new Set(kit.questions.map((q) => q.id));

    for (const q of kit.questions) {
      for (const rid of q.requirement_ids) {
        if (!requirementIds.has(rid)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `question ${q.id} references unknown requirement ${rid}`,
            path: ["questions"],
          });
        }
      }
    }
    for (const f of kit.flashcards) {
      for (const rid of f.requirement_ids) {
        if (!requirementIds.has(rid)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `flashcard ${f.id} references unknown requirement ${rid}`,
            path: ["flashcards"],
          });
        }
      }
    }
    for (const day of kit.schedule.days) {
      for (const qid of day.question_ids) {
        if (!questionIds.has(qid)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `schedule day ${day.day} references unknown question ${qid}`,
            path: ["schedule"],
          });
        }
      }
    }
    if (kit.schedule.days.length !== kit.schedule.days_available) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `schedule has ${kit.schedule.days.length} days but days_available is ${kit.schedule.days_available}`,
        path: ["schedule", "days"],
      });
    }
  });

export type ValidatedKit = z.infer<typeof kitSchema>;

export function validateKit(kit: unknown) {
  return kitSchema.safeParse(kit);
}
