import { researchCompany } from "../services/research/researchCompany.js";
import { generateCompanyBrief } from "../services/generation/companyBrief.js";
import { categoriesForRequirement, generateQuestionsForCategory } from "../services/generation/questionGeneration.js";
import { buildSchedule } from "../services/scheduling/scheduleBuilder.js";
import { checkCoverage } from "../services/coverage/coverageCheck.js";
import type { CompanyBrief, Question, QuestionCategory, Requirement, Schedule } from "../types/kit.js";
import type { ResearchContext } from "./generateKit.js";

/**
 * Regeneration for a single kit section. This is the hardest state problem
 * in the assessment (Section 6): a regenerate action must never discard a
 * user's edits made elsewhere in the kit, and anything the user wrote or
 * hand-edited within the *regenerated* section itself must survive too.
 *
 * The representation we use for that: every question and flashcard carries
 * `origin` ("generated" | "edited" | "user_added") and a `pinned` flag.
 * Regenerating a category only ever replaces items in that category whose
 * origin is still "generated" and which are not pinned — anything the user
 * touched or added, or explicitly pinned, is left alone and simply kept.
 */

export interface RegenerateBriefResult {
  brief: CompanyBrief;
  pagesUsed: string[];
  researchContext: ResearchContext;
}

export async function regenerateBrief(companyUrl: string, companyNameFallback: string): Promise<RegenerateBriefResult> {
  const research = await researchCompany(companyUrl);
  const brief = await generateCompanyBrief(research.pages, research.companyNameFallback || companyNameFallback);
  return {
    brief: { summary: brief.summary, what_they_do: brief.what_they_do, sources: research.pages.map((p) => p.url), origin: "generated", pinned: false },
    pagesUsed: research.pages.map((p) => p.url),
    researchContext: {
      hiringProcessNotes: research.hiringProcessNotes,
      hiringMentionsSystemDesign: research.hiringMentionsSystemDesign,
      seniorRole: false, // caller (route) overlays the previously known seniorRole flag
    },
  };
}

export interface RegenerateCategoryResult {
  questions: Question[]; // the full, updated question list for the whole kit
  uncoveredMustHaveIds: string[];
}

export async function regenerateQuestionCategory(
  category: QuestionCategory,
  allRequirements: Requirement[],
  existingQuestions: Question[],
  ctx: { roleTitle: string; companySummary: string; researchContext: ResearchContext }
): Promise<RegenerateCategoryResult> {
  const kept = existingQuestions.filter((q) => q.category !== category || q.origin !== "generated" || q.pinned);

  const requirementsForCategory = allRequirements.filter((r) =>
    categoriesForRequirement(r, ctx.researchContext).includes(category)
  );

  const fresh = await generateQuestionsForCategory(category, requirementsForCategory, {
    roleTitle: ctx.roleTitle,
    companySummary: ctx.companySummary,
    hiringProcessNotes: ctx.researchContext.hiringProcessNotes,
    questionsPerRequirement: 1,
  });

  const questions = [...kept, ...fresh];
  const coverage = checkCoverage(allRequirements, questions);
  return { questions, uncoveredMustHaveIds: coverage.uncoveredMustHaveIds };
}

export function regenerateSchedule(requirements: Requirement[], questions: Question[], days: number): Schedule {
  const schedule = buildSchedule(requirements, questions, days);
  return { ...schedule, origin: "generated", pinned: false };
}
