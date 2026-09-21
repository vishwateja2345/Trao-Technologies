import { Router } from "express";
import { z } from "zod";
import { Kit } from "../models/Kit.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler, ApiError } from "../middleware/errors.js";
import * as kitService from "../services/kitService.js";
import { toAppendixAShape } from "../types/kit.js";

export const kitsRouter = Router();
kitsRouter.use(requireAuth);

const createKitSchema = z.object({
  jd: z.string().min(1, "Job description is required."),
  company_url: z.string().min(1, "Company URL is required."),
  days: z.coerce.number().int().min(1).max(120),
});

function summarize(kit: any) {
  return {
    id: kit._id,
    status: kit.status,
    company: kit.source?.company || "",
    role: kit.source?.role || kit.role?.title || "",
    days: kit.input?.days,
    uncovered: kit.coverage?.uncovered_requirement_ids?.length ?? 0,
    failureReason: kit.failureReason,
    createdAt: kit.createdAt,
    updatedAt: kit.updatedAt,
  };
}

async function loadOwnedKit(userId: string, kitId: string) {
  const kit = await Kit.findOne({ _id: kitId, userId });
  if (!kit) throw new ApiError(404, "KIT_NOT_FOUND", "Kit not found.");
  return kit;
}

kitsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = createKitSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "INVALID_INPUT", "Invalid kit input.", parsed.error.flatten());

    const { kit, reused } = await kitService.createAndStartKit(req.user!.userId, parsed.data);
    res.status(reused ? 200 : 201).json({ kit: summarize(kit), reused });
  })
);

const batchCaseSchema = z.object({
  jd: z.string().min(1),
  company_url: z.string().min(1),
  days: z.coerce.number().int().min(1).max(120),
});

kitsRouter.post(
  "/batch",
  asyncHandler(async (req, res) => {
    const parsed = z.array(batchCaseSchema).min(1).max(50).safeParse(req.body?.cases);
    if (!parsed.success) throw new ApiError(400, "INVALID_INPUT", "Invalid batch input.", parsed.error.flatten());

    const results = [];
    for (const c of parsed.data) {
      const { kit, reused } = await kitService.createAndStartKit(req.user!.userId, c);
      results.push(summarize({ ...kit.toObject() }));
      void reused; // each is independently deduped by createAndStartKit
    }
    res.status(201).json({ kits: results });
  })
);

kitsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const kits = await Kit.find({ userId: req.user!.userId }).sort({ createdAt: -1 });
    res.json({ kits: kits.map(summarize) });
  })
);

kitsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const kit = await loadOwnedKit(req.user!.userId, req.params.id);
    res.json({
      kit: {
        id: kit._id,
        status: kit.status,
        failureReason: kit.failureReason,
        generationSteps: kit.generationSteps,
        input: kit.input,
        practiceRecords: kit.practiceRecords,
        ...toAppendixAShape(kit.toObject() as any),
        // Overlay bookkeeping fields the strict Appendix A shape strips out,
        // so the builder UI can render pinned/edited badges.
        company_brief: kit.company_brief,
        schedule: kit.schedule,
      },
    });
  })
);

kitsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const kit = await loadOwnedKit(req.user!.userId, req.params.id);
    await kit.deleteOne();
    res.status(204).end();
  })
);

kitsRouter.patch(
  "/:id/brief",
  asyncHandler(async (req, res) => {
    const kit = await loadOwnedKit(req.user!.userId, req.params.id);
    const schema = z.object({ summary: z.string().optional(), what_they_do: z.string().optional(), pinned: z.boolean().optional() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "INVALID_INPUT", "Invalid brief patch.", parsed.error.flatten());
    if (parsed.data.pinned !== undefined) await kitService.setBriefPinned(kit, parsed.data.pinned);
    await kitService.editBrief(kit, parsed.data);
    res.json({ company_brief: kit.company_brief });
  })
);

const questionInputSchema = z.object({
  category: z.enum(["technical", "behavioural", "system-design", "company-fit"]),
  prompt: z.string().min(1),
  answer_outline: z.string().optional(),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  requirement_ids: z.array(z.string()).optional(),
});

kitsRouter.post(
  "/:id/questions",
  asyncHandler(async (req, res) => {
    const kit = await loadOwnedKit(req.user!.userId, req.params.id);
    const parsed = questionInputSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "INVALID_INPUT", "Invalid question input.", parsed.error.flatten());
    await kitService.addQuestion(kit, parsed.data);
    res.status(201).json({ questions: kit.questions, coverage: kit.coverage });
  })
);

kitsRouter.patch(
  "/:id/questions/:qid",
  asyncHandler(async (req, res) => {
    const kit = await loadOwnedKit(req.user!.userId, req.params.id);
    const updated = await kitService.editQuestion(kit, req.params.qid, req.body ?? {});
    if (!updated) throw new ApiError(404, "QUESTION_NOT_FOUND", "Question not found.");
    res.json({ questions: kit.questions, coverage: kit.coverage });
  })
);

kitsRouter.delete(
  "/:id/questions/:qid",
  asyncHandler(async (req, res) => {
    const kit = await loadOwnedKit(req.user!.userId, req.params.id);
    await kitService.deleteQuestion(kit, req.params.qid);
    res.json({ questions: kit.questions, coverage: kit.coverage });
  })
);

kitsRouter.post(
  "/:id/questions/reorder",
  asyncHandler(async (req, res) => {
    const kit = await loadOwnedKit(req.user!.userId, req.params.id);
    const schema = z.object({
      category: z.enum(["technical", "behavioural", "system-design", "company-fit"]),
      ordered_ids: z.array(z.string()),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "INVALID_INPUT", "Invalid reorder input.", parsed.error.flatten());
    await kitService.reorderQuestions(kit, parsed.data.category, parsed.data.ordered_ids);
    res.json({ questions: kit.questions });
  })
);

const flashcardInputSchema = z.object({
  front: z.string().min(1),
  back: z.string().min(1),
  requirement_ids: z.array(z.string()).optional(),
});

kitsRouter.post(
  "/:id/flashcards",
  asyncHandler(async (req, res) => {
    const kit = await loadOwnedKit(req.user!.userId, req.params.id);
    const parsed = flashcardInputSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "INVALID_INPUT", "Invalid flashcard input.", parsed.error.flatten());
    await kitService.addFlashcard(kit, parsed.data);
    res.status(201).json({ flashcards: kit.flashcards });
  })
);

kitsRouter.patch(
  "/:id/flashcards/:fid",
  asyncHandler(async (req, res) => {
    const kit = await loadOwnedKit(req.user!.userId, req.params.id);
    const updated = await kitService.editFlashcard(kit, req.params.fid, req.body ?? {});
    if (!updated) throw new ApiError(404, "FLASHCARD_NOT_FOUND", "Flashcard not found.");
    res.json({ flashcards: kit.flashcards });
  })
);

kitsRouter.delete(
  "/:id/flashcards/:fid",
  asyncHandler(async (req, res) => {
    const kit = await loadOwnedKit(req.user!.userId, req.params.id);
    await kitService.deleteFlashcard(kit, req.params.fid);
    res.json({ flashcards: kit.flashcards });
  })
);

kitsRouter.post(
  "/:id/regenerate",
  asyncHandler(async (req, res) => {
    const kit = await loadOwnedKit(req.user!.userId, req.params.id);
    const schema = z.object({ section: z.string().min(1), force: z.boolean().optional(), days: z.number().int().min(1).max(120).optional() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "INVALID_INPUT", "Invalid regenerate input.", parsed.error.flatten());

    const result = await kitService.regenerateKitSection(kit, parsed.data.section, {
      force: parsed.data.force,
      days: parsed.data.days,
    });
    if (!result.ok) throw new ApiError(409, "SECTION_LOCKED", result.reason);

    res.json({
      company_brief: kit.company_brief,
      questions: kit.questions,
      schedule: kit.schedule,
      coverage: kit.coverage,
    });
  })
);

kitsRouter.post(
  "/:id/practice",
  asyncHandler(async (req, res) => {
    const kit = await loadOwnedKit(req.user!.userId, req.params.id);
    const schema = z.object({ flashcard_id: z.string(), confidence: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "INVALID_INPUT", "Invalid practice input.", parsed.error.flatten());
    await kitService.recordPractice(kit, parsed.data.flashcard_id, parsed.data.confidence);
    res.status(201).json({ practiceRecords: kit.practiceRecords });
  })
);

kitsRouter.get(
  "/:id/practice/queue",
  asyncHandler(async (req, res) => {
    const kit = await loadOwnedKit(req.user!.userId, req.params.id);
    res.json({ queue: kitService.buildPracticeQueue(kit) });
  })
);

kitsRouter.get(
  "/:id/weak-spots",
  asyncHandler(async (req, res) => {
    const kit = await loadOwnedKit(req.user!.userId, req.params.id);
    res.json({ report: kitService.buildWeakSpotsReport(kit) });
  })
);
