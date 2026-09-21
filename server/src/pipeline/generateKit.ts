import { env } from "../config/env.js";
import { resetIdCounters } from "../utils/ids.js";
import { extractRequirements } from "../services/generation/extractRequirements.js";
import { researchCompany } from "../services/research/researchCompany.js";
import { generateCompanyBrief } from "../services/generation/companyBrief.js";
import {
  categoriesForRequirement,
  generateQuestionsForCategory,
} from "../services/generation/questionGeneration.js";
import { generateFlashcards } from "../services/generation/flashcards.js";
import { checkCoverage } from "../services/coverage/coverageCheck.js";
import { buildSchedule } from "../services/scheduling/scheduleBuilder.js";
import { validateKit } from "../services/validation/kitSchema.js";
import type { Kit, GenerationStep, Question, QuestionCategory, Requirement } from "../types/kit.js";

export interface PipelineInput {
  jd: string;
  companyUrl: string;
  days: number;
}

export interface PipelineWarning {
  step: string;
  message: string;
}

export interface ResearchContext {
  hiringProcessNotes: string;
  hiringMentionsSystemDesign: boolean;
  seniorRole: boolean;
}

export interface PipelineResult {
  kit: Kit;
  steps: GenerationStep[];
  warnings: PipelineWarning[];
  status: "ready" | "partial";
  researchContext: ResearchContext;
}

export class PipelineFatalError extends Error {
  constructor(public code: string, message: string, public cause?: unknown) {
    super(message);
    this.name = "PipelineFatalError";
  }
}

function nowIso() {
  return new Date().toISOString();
}

/**
 * Groups requirements by the question category(ies) each maps to. A
 * requirement can map to more than one category (e.g. a senior technical
 * requirement also gets a system-design question when the hiring process is
 * known to include one) — see categoriesForRequirement for the rule.
 */
function groupByCategory(
  requirements: Requirement[],
  ctxFlags: { hiringMentionsSystemDesign: boolean; seniorRole: boolean }
): Map<QuestionCategory, Requirement[]> {
  const byCategory = new Map<QuestionCategory, Requirement[]>();
  for (const req of requirements) {
    for (const cat of categoriesForRequirement(req, ctxFlags)) {
      if (!byCategory.has(cat)) byCategory.set(cat, []);
      byCategory.get(cat)!.push(req);
    }
  }
  return byCategory;
}

/**
 * The single orchestration path used by both the HTTP API and the batch
 * `npm run evaluate` entry point (Section 9 requires the same code, not a
 * parallel implementation). Steps run in the sequence the brief describes:
 * pasted text is parsed first (needs no retrieval), then the company site is
 * crawled, then discussion is searched, then generation proceeds informed by
 * what was actually found, then a deterministic coverage pass closes gaps,
 * then deterministic scheduling runs last.
 */
export async function runPipeline(
  input: PipelineInput,
  onStep?: (step: GenerationStep) => void
): Promise<PipelineResult> {
  resetIdCounters();
  const steps: GenerationStep[] = [];
  const warnings: PipelineWarning[] = [];

  const recordStep = (name: string, status: GenerationStep["status"], detail?: string) => {
    const step: GenerationStep = { name, status, detail, finished_at: nowIso() };
    steps.push(step);
    onStep?.(step);
  };

  if (!input.jd || !input.jd.trim()) {
    throw new PipelineFatalError("EMPTY_JD", "Job description is empty.");
  }

  // --- Step 1: extract requirements from the pasted JD (no retrieval needed) ---
  let extracted;
  try {
    extracted = await extractRequirements(input.jd);
    recordStep(
      "extract_requirements",
      "done",
      extracted.thin ? "Job description is very short; extraction may be thin." : undefined
    );
  } catch (err) {
    recordStep("extract_requirements", "failed", String(err));
    throw new PipelineFatalError("JD_EXTRACTION_FAILED", "Could not extract requirements from the job description.", err);
  }

  if (extracted.thin) {
    warnings.push({
      step: "extract_requirements",
      message: "The job description was very short. Few requirements could be extracted honestly rather than invented.",
    });
  }

  // --- Steps 2 & 3: crawl the company site + search public discussion ---
  const research = await researchCompany(input.companyUrl);
  recordStep(
    "crawl_company_site",
    research.pages.length > 0 ? "done" : "skipped",
    research.hiringPageFound
      ? `Found ${research.hiringUrls.length} likely hiring page(s).`
      : "No discoverable hiring page found on the company site."
  );
  if (research.skipped.length > 0) {
    warnings.push({
      step: "crawl_company_site",
      message: `${research.skipped.length} page(s) could not be retrieved and were skipped: ${research.skipped
        .map((s) => `${s.url} (${s.reason})`)
        .join(", ")}`,
    });
  }
  if (!research.hiringPageFound) {
    warnings.push({ step: "crawl_company_site", message: "No hiring/interview-process page was discoverable on the company site." });
  }

  recordStep(
    "search_interview_discussion",
    research.discussion.searched ? "done" : "skipped",
    research.discussion.searched ? `${research.discussion.snippets.length} snippet(s) found.` : research.discussion.error
  );
  if (research.discussion.searched && research.discussion.snippets.length === 0) {
    warnings.push({ step: "search_interview_discussion", message: "Public discussion search returned nothing." });
  }
  if (!research.discussion.searched) {
    warnings.push({ step: "search_interview_discussion", message: `Discussion search unavailable: ${research.discussion.error}` });
  }

  const seniorRole = /senior|staff|principal|lead/i.test(extracted.seniority || extracted.title || "");
  const researchContext: ResearchContext = {
    hiringProcessNotes: research.hiringProcessNotes,
    hiringMentionsSystemDesign: research.hiringMentionsSystemDesign,
    seniorRole,
  };

  // --- Step 4: generate the company brief from crawled pages ---
  let brief;
  try {
    brief = await generateCompanyBrief(research.pages, research.companyNameFallback);
    recordStep("generate_company_brief", "done");
  } catch (err) {
    recordStep("generate_company_brief", "failed", String(err));
    warnings.push({ step: "generate_company_brief", message: `Brief generation failed: ${String(err)}` });
    brief = { company: research.companyNameFallback, summary: "The company brief could not be generated.", what_they_do: "" };
  }

  // --- Step 5: generate questions, one call per category (never mixed) ---
  const byCategory = groupByCategory(extracted.requirements, researchContext);
  let questions: Question[] = [];
  for (const [category, reqs] of byCategory) {
    try {
      const generated = await generateQuestionsForCategory(category, reqs, {
        roleTitle: extracted.title,
        companySummary: brief.summary,
        hiringProcessNotes: researchContext.hiringProcessNotes,
        questionsPerRequirement: 1,
      });
      questions = questions.concat(generated);
      recordStep(`generate_questions_${category}`, "done", `${generated.length} question(s).`);
    } catch (err) {
      recordStep(`generate_questions_${category}`, "failed", String(err));
      warnings.push({ step: `generate_questions_${category}`, message: String(err) });
    }
  }

  // --- Step 6: deterministic coverage check + bounded gap-filling passes ---
  let passes = 1;
  let coverage = checkCoverage(extracted.requirements, questions);
  const reqById = new Map(extracted.requirements.map((r) => [r.id, r]));

  while (coverage.uncoveredMustHaveIds.length > 0 && passes < env.MAX_COVERAGE_PASSES) {
    const gapReqs = coverage.uncoveredMustHaveIds.map((id) => reqById.get(id)!).filter(Boolean);
    const gapByCategory = groupByCategory(gapReqs, researchContext);
    let filledAny = false;
    for (const [category, reqs] of gapByCategory) {
      try {
        const generated = await generateQuestionsForCategory(category, reqs, {
          roleTitle: extracted.title,
          companySummary: brief.summary,
          hiringProcessNotes: researchContext.hiringProcessNotes,
          questionsPerRequirement: 1,
        });
        questions = questions.concat(generated);
        filledAny = filledAny || generated.length > 0;
      } catch (err) {
        warnings.push({ step: "coverage_gap_fill", message: String(err) });
      }
    }
    passes += 1;
    coverage = checkCoverage(extracted.requirements, questions);
    recordStep(
      "coverage_gap_fill",
      "done",
      `Pass ${passes}: ${coverage.uncoveredMustHaveIds.length} must-have requirement(s) still uncovered.`
    );
    if (!filledAny) break; // avoid an infinite loop if generation keeps failing
  }

  if (coverage.uncoveredMustHaveIds.length > 0) {
    warnings.push({
      step: "coverage_gap_fill",
      message: `${coverage.uncoveredMustHaveIds.length} must-have requirement(s) remain uncovered after ${env.MAX_COVERAGE_PASSES} pass(es).`,
    });
  }

  // --- Step 7: flashcards (one set of requirement-linked cards) ---
  let flashcards: Awaited<ReturnType<typeof generateFlashcards>> = [];
  try {
    flashcards = await generateFlashcards(extracted.requirements);
    recordStep("generate_flashcards", "done", `${flashcards.length} card(s).`);
  } catch (err) {
    recordStep("generate_flashcards", "failed", String(err));
    warnings.push({ step: "generate_flashcards", message: String(err) });
  }

  // --- Step 8: deterministic schedule allocation ---
  const schedule = buildSchedule(extracted.requirements, questions, input.days);
  recordStep("build_schedule", "done", `${schedule.days.length} day(s).`);

  const kit: Kit = {
    source: {
      company: brief.company || research.companyNameFallback,
      company_url: input.companyUrl || "",
      role: extracted.title,
      location: "",
      jd_chars: input.jd.length,
      researched_at: nowIso(),
      pages_used: research.pages.map((p) => p.url),
    },
    company_brief: {
      summary: brief.summary,
      what_they_do: brief.what_they_do,
      sources: research.pages.map((p) => p.url),
      origin: "generated",
      pinned: false,
    },
    role: {
      title: extracted.title,
      seniority: extracted.seniority,
      responsibilities: extracted.responsibilities,
      requirements: extracted.requirements,
    },
    questions,
    flashcards,
    schedule: { ...schedule, origin: "generated", pinned: false },
    coverage: {
      uncovered_requirement_ids: coverage.uncoveredMustHaveIds,
      passes,
    },
  };

  const validation = validateKit(kit);
  if (!validation.success) {
    throw new PipelineFatalError("KIT_VALIDATION_FAILED", `Generated kit failed structural validation: ${validation.error.message}`);
  }

  const status = coverage.uncoveredMustHaveIds.length > 0 || warnings.length > 0 ? "partial" : "ready";
  return { kit, steps, warnings, status, researchContext };
}
