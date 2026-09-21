import crypto from "node:crypto";
import { Kit, type KitDoc } from "../models/Kit.js";
import { runPipeline, PipelineFatalError, type ResearchContext } from "../pipeline/generateKit.js";
import { regenerateBrief, regenerateQuestionCategory, regenerateSchedule } from "../pipeline/regenerateSection.js";
import { checkCoverage } from "../services/coverage/coverageCheck.js";
import { nextId, resetIdCounters } from "../utils/ids.js";
import type { ItemOrigin, QuestionCategory } from "../types/kit.js";

export interface CreateKitInput {
  jd: string;
  company_url: string;
  days: number;
}

export function computeRequestHash(userId: string, jd: string, companyUrl: string): string {
  return crypto
    .createHash("sha256")
    .update(`${userId}::${jd.trim()}::${companyUrl.trim().toLowerCase()}`)
    .digest("hex");
}

/**
 * Creates (or, for a duplicate description+company pair, reuses) a kit
 * record and kicks off generation in the background. The route returns
 * immediately with the kit id; the frontend polls GET /api/kits/:id for
 * progress. This is a deliberately simple job model — no Redis/queue — a
 * reasonable trade-off for this assessment's scope, documented as a known
 * limitation in the README (a restart mid-generation loses that one job;
 * the user can just retry).
 */
export async function createAndStartKit(userId: string, input: CreateKitInput) {
  const requestHash = computeRequestHash(userId, input.jd, input.company_url);

  const existing = await Kit.findOne({ userId, requestHash });
  if (existing) {
    return { kit: existing, reused: true };
  }

  let kit: KitDoc;
  try {
    kit = await Kit.create({
      userId,
      requestHash,
      input: { jd: input.jd, company_url: input.company_url, days: input.days },
      status: "pending",
      generationSteps: [],
    });
  } catch (err: any) {
    if (err?.code === 11000) {
      // Race: two near-simultaneous submissions of the same jd+company.
      const raced = await Kit.findOne({ userId, requestHash });
      if (raced) return { kit: raced, reused: true };
    }
    throw err;
  }

  void runGenerationForKit(kit._id.toString()).catch((err) => {
    console.error(`Unhandled error running generation for kit ${kit._id}:`, err);
  });

  return { kit, reused: false };
}

export async function runGenerationForKit(kitId: string): Promise<void> {
  const kit = await Kit.findById(kitId);
  if (!kit) return;

  kit.status = "researching";
  await kit.save();

  try {
    const result = await runPipeline(
      { jd: kit.input.jd, companyUrl: kit.input.company_url, days: kit.input.days },
      (step) => {
        // Persist progress incrementally so the frontend's poll shows
        // real, in-flight step status rather than an opaque spinner.
        void Kit.updateOne({ _id: kitId }, { $push: { generationSteps: step }, $set: { status: "generating" } }).catch(() => {});
      }
    );

    kit.status = result.status;
    kit.source = result.kit.source;
    kit.company_brief = result.kit.company_brief;
    kit.role = result.kit.role;
    kit.questions = result.kit.questions;
    kit.flashcards = result.kit.flashcards;
    kit.schedule = result.kit.schedule;
    kit.coverage = result.kit.coverage;
    kit.researchContext = result.researchContext;
    kit.failureReason =
      result.warnings.length > 0 ? result.warnings.map((w) => `[${w.step}] ${w.message}`).join(" | ") : null;
    await kit.save();
  } catch (err) {
    kit.status = "failed";
    kit.failureReason =
      err instanceof PipelineFatalError ? `${err.code}: ${err.message}` : `UNEXPECTED_ERROR: ${String(err)}`;
    await kit.save();
  }
}

function markEdited(currentOrigin: ItemOrigin | undefined): ItemOrigin {
  return currentOrigin === "user_added" ? "user_added" : "edited";
}

export async function editBrief(kit: KitDoc, patch: { summary?: string; what_they_do?: string }) {
  if (patch.summary !== undefined) kit.company_brief.summary = patch.summary;
  if (patch.what_they_do !== undefined) kit.company_brief.what_they_do = patch.what_they_do;
  kit.company_brief.origin = markEdited(kit.company_brief.origin);
  await kit.save();
  return kit;
}

export async function setBriefPinned(kit: KitDoc, pinned: boolean) {
  kit.company_brief.pinned = pinned;
  await kit.save();
  return kit;
}

function recomputeCoverage(kit: KitDoc) {
  const coverage = checkCoverage(kit.role.requirements, kit.questions);
  kit.coverage.uncovered_requirement_ids = coverage.uncoveredMustHaveIds;
}

export async function addQuestion(
  kit: KitDoc,
  input: { category: QuestionCategory; prompt: string; answer_outline?: string; difficulty?: 1 | 2 | 3; requirement_ids?: string[] }
) {
  resetIdCounters();
  // Continue id numbering past whatever already exists so ids stay unique.
  const existingMax = kit.questions.reduce((max, q) => {
    const n = Number(String(q.id).replace(/^q/, ""));
    return Number.isFinite(n) ? Math.max(max, n) : max;
  }, 0);
  for (let i = 0; i < existingMax; i++) nextId("q");

  kit.questions.push({
    id: nextId("q"),
    requirement_ids: input.requirement_ids ?? [],
    category: input.category,
    prompt: input.prompt,
    answer_outline: input.answer_outline ?? "",
    difficulty: input.difficulty ?? 2,
    origin: "user_added",
    pinned: true,
  });
  recomputeCoverage(kit);
  await kit.save();
  return kit;
}

export async function editQuestion(kit: KitDoc, questionId: string, patch: Record<string, unknown>) {
  const q = kit.questions.find((item) => item.id === questionId);
  if (!q) return null;
  const editableFields = ["prompt", "answer_outline", "difficulty", "category", "requirement_ids", "pinned"] as const;
  let contentChanged = false;
  for (const field of editableFields) {
    if (field in patch) {
      (q as unknown as Record<string, unknown>)[field] = patch[field];
      if (field !== "pinned") contentChanged = true;
    }
  }
  if (contentChanged) q.origin = markEdited(q.origin);
  recomputeCoverage(kit);
  await kit.save();
  return kit;
}

export async function deleteQuestion(kit: KitDoc, questionId: string) {
  kit.questions = kit.questions.filter((q) => q.id !== questionId);
  recomputeCoverage(kit);
  await kit.save();
  return kit;
}

export async function reorderQuestions(kit: KitDoc, category: QuestionCategory, orderedIds: string[]) {
  const all = kit.questions;
  const inCategory = new Map(all.filter((q) => q.category === category).map((q) => [q.id, q]));
  const others = all.filter((q) => q.category !== category);

  const firstIndex = all.findIndex((q) => q.category === category);
  const reordered = orderedIds.map((id) => inCategory.get(id)).filter((q): q is (typeof all)[number] => Boolean(q));
  // Anything in the category not present in orderedIds (shouldn't happen, but be safe) keeps its relative place at the end.
  for (const q of inCategory.values()) if (!orderedIds.includes(q.id)) reordered.push(q);

  const merged = [...others];
  merged.splice(firstIndex === -1 ? merged.length : firstIndex, 0, ...reordered);
  kit.questions = merged;
  await kit.save();
  return kit;
}

export async function addFlashcard(kit: KitDoc, input: { front: string; back: string; requirement_ids?: string[] }) {
  const existingMax = kit.flashcards.reduce((max, f) => {
    const n = Number(String(f.id).replace(/^f/, ""));
    return Number.isFinite(n) ? Math.max(max, n) : max;
  }, 0);
  kit.flashcards.push({
    id: `f${existingMax + 1}`,
    front: input.front,
    back: input.back,
    requirement_ids: input.requirement_ids ?? [],
    origin: "user_added",
    pinned: true,
  });
  await kit.save();
  return kit;
}

export async function editFlashcard(kit: KitDoc, flashcardId: string, patch: Record<string, unknown>) {
  const f = kit.flashcards.find((item) => item.id === flashcardId);
  if (!f) return null;
  const editableFields = ["front", "back", "requirement_ids", "pinned"] as const;
  let contentChanged = false;
  for (const field of editableFields) {
    if (field in patch) {
      (f as unknown as Record<string, unknown>)[field] = patch[field];
      if (field !== "pinned") contentChanged = true;
    }
  }
  if (contentChanged) f.origin = markEdited(f.origin);
  await kit.save();
  return kit;
}

export async function deleteFlashcard(kit: KitDoc, flashcardId: string) {
  kit.flashcards = kit.flashcards.filter((f) => f.id !== flashcardId);
  await kit.save();
  return kit;
}

export async function regenerateKitSection(
  kit: KitDoc,
  section: string,
  opts: { force?: boolean; days?: number } = {}
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (section === "brief") {
    if (kit.company_brief.pinned || (kit.company_brief.origin === "edited" && !opts.force)) {
      return { ok: false, reason: "Brief has been edited/pinned. Pass force=true to overwrite." };
    }
    const result = await regenerateBrief(kit.input.company_url, kit.source.company);
    kit.company_brief = result.brief;
    kit.source.pages_used = result.pagesUsed;
    kit.researchContext = { ...result.researchContext, seniorRole: kit.researchContext?.seniorRole ?? false };
    await kit.save();
    return { ok: true };
  }

  if (section === "schedule") {
    if (kit.schedule.pinned || (kit.schedule.origin === "edited" && !opts.force)) {
      return { ok: false, reason: "Schedule has been edited/pinned. Pass force=true to overwrite." };
    }
    const days = opts.days ?? kit.input.days;
    kit.schedule = regenerateSchedule(kit.role.requirements, kit.questions, days);
    kit.input.days = days;
    await kit.save();
    return { ok: true };
  }

  if (section.startsWith("questions:")) {
    const category = section.split(":")[1] as QuestionCategory;
    const researchContext: ResearchContext = kit.researchContext ?? {
      hiringProcessNotes: "",
      hiringMentionsSystemDesign: false,
      seniorRole: false,
    };
    const result = await regenerateQuestionCategory(category, kit.role.requirements, kit.questions, {
      roleTitle: kit.role.title,
      companySummary: kit.company_brief.summary,
      researchContext,
    });
    kit.questions = result.questions;
    kit.coverage.uncovered_requirement_ids = result.uncoveredMustHaveIds;
    await kit.save();
    return { ok: true };
  }

  return { ok: false, reason: `Unknown section "${section}".` };
}

export async function recordPractice(kit: KitDoc, flashcardId: string, confidence: 1 | 2 | 3 | 4 | 5) {
  kit.practiceRecords.push({ flashcard_id: flashcardId, confidence, reviewed_at: new Date().toISOString() });
  await kit.save();
  return kit;
}

export interface PracticeQueueItem {
  flashcard_id: string;
  front: string;
  back: string;
  last_confidence: number | null;
  times_reviewed: number;
}

/**
 * Practice ordering: cards never reviewed rank as least-confident (treated
 * as confidence 0) and come first; reviewed cards are then sorted by their
 * most recent confidence score ascending, so what the user felt shakiest on
 * last comes right after anything untouched. This is the "simple
 * confidence-weighted sort" option the brief explicitly allows as
 * sufficient — see README for why we picked it over a full spaced-repetition
 * interval model.
 */
export function buildPracticeQueue(kit: KitDoc): PracticeQueueItem[] {
  const recordsByCard = new Map<string, { confidence: number; reviewed_at: string }[]>();
  for (const r of kit.practiceRecords) {
    if (!recordsByCard.has(r.flashcard_id)) recordsByCard.set(r.flashcard_id, []);
    recordsByCard.get(r.flashcard_id)!.push(r);
  }

  return kit.flashcards
    .map((card) => {
      const records = (recordsByCard.get(card.id) ?? []).sort((a, b) => a.reviewed_at.localeCompare(b.reviewed_at));
      const last = records[records.length - 1];
      return {
        flashcard_id: card.id,
        front: card.front,
        back: card.back,
        last_confidence: last ? last.confidence : null,
        times_reviewed: records.length,
      };
    })
    .sort((a, b) => (a.last_confidence ?? 0) - (b.last_confidence ?? 0));
}

export interface WeakSpotEntry {
  requirement_id: string;
  text: string;
  priority: "must" | "nice";
  kind: string;
  status: "gap" | "weak" | "unpracticed" | "solid";
  question_count: number;
  flashcard_count: number;
  avg_confidence: number | null;
}

/**
 * Creative feature: the "weak spots report". Coverage tells you a
 * requirement has a question; it says nothing about whether *you* have
 * actually practised it, or how confident you felt. This report is a
 * deterministic rollup (no LLM call) that joins three signals already in
 * the kit — coverage gaps, how many questions/flashcards exist per
 * requirement, and this user's own practice confidence history — into one
 * ranked list of what to focus remaining prep time on. It directly answers
 * "what should I study next" instead of leaving the user to infer it from
 * three separate tabs.
 */
export function buildWeakSpotsReport(kit: KitDoc): WeakSpotEntry[] {
  const uncovered = new Set(kit.coverage.uncovered_requirement_ids);

  const latestConfidenceByCard = new Map<string, number>();
  for (const r of [...kit.practiceRecords].sort((a, b) => a.reviewed_at.localeCompare(b.reviewed_at))) {
    latestConfidenceByCard.set(r.flashcard_id, r.confidence);
  }

  const entries: WeakSpotEntry[] = kit.role.requirements.map((req) => {
    const linkedQuestions = kit.questions.filter((q) => q.requirement_ids.includes(req.id));
    const linkedCards = kit.flashcards.filter((f) => f.requirement_ids.includes(req.id));
    const confidences = linkedCards
      .map((c) => latestConfidenceByCard.get(c.id))
      .filter((c): c is number => c !== undefined);
    const avgConfidence = confidences.length ? confidences.reduce((a, b) => a + b, 0) / confidences.length : null;

    let status: WeakSpotEntry["status"];
    if (uncovered.has(req.id)) status = "gap";
    else if (avgConfidence === null) status = "unpracticed";
    else if (avgConfidence <= 2.5) status = "weak";
    else status = "solid";

    return {
      requirement_id: req.id,
      text: req.text,
      priority: req.priority,
      kind: req.kind,
      status,
      question_count: linkedQuestions.length,
      flashcard_count: linkedCards.length,
      avg_confidence: avgConfidence,
    };
  });

  const statusRank: Record<WeakSpotEntry["status"], number> = { gap: 0, weak: 1, unpracticed: 2, solid: 3 };
  return entries.sort((a, b) => {
    if (statusRank[a.status] !== statusRank[b.status]) return statusRank[a.status] - statusRank[b.status];
    if (a.priority !== b.priority) return a.priority === "must" ? -1 : 1;
    return (a.avg_confidence ?? 0) - (b.avg_confidence ?? 0);
  });
}
