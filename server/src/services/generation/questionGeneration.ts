import { z } from "zod";
import { getLLMClient } from "./llmClientFactory.js";
import { extractJson } from "./jsonExtract.js";
import { fenceUntrusted } from "./promptSafety.js";
import { nextId } from "../../utils/ids.js";
import type { Question, QuestionCategory, Requirement } from "../../types/kit.js";

/**
 * Step: "Generate questions for a given requirement and category."
 *
 * One call is made per question *category* (never mixing categories in one
 * call — a "5+ years React" requirement and a "mentors juniors" requirement
 * must not be handed to the model with the same instructions), but a call
 * batches every requirement that maps to that category so a 15-minute /
 * 5-case batch budget is achievable on a free-tier model. This is the
 * middle ground the brief asks for: distinct instructions per category,
 * without one HTTP round-trip per individual requirement.
 */

const CATEGORY_SYSTEM_PROMPTS: Record<QuestionCategory, string> = {
  technical: `You write TECHNICAL interview questions that test hands-on skill
with the specific tools, languages and practices named in each requirement.
Prefer concrete, answerable questions over trivia. Each question must be
answerable by someone who genuinely has the requirement, and unanswerable
by someone who doesn't.`,
  behavioural: `You write BEHAVIOURAL interview questions (STAR-style) that
probe how a candidate has actually acted in past situations relevant to
each requirement (mentoring, collaboration, conflict, ownership, communication).
Do not write technical trivia here.`,
  "system-design": `You write SYSTEM-DESIGN interview questions appropriate for
a candidate at the seniority implied by the requirements. Focus on
architecture, trade-offs, and scale relevant to the requirement's domain.`,
  "company-fit": `You write COMPANY-FIT / motivational interview questions that
connect the candidate's background to what this specific company does,
based on the company brief provided. Avoid generic "why do you want this
job" questions with no company-specific grounding when company info is
available.`,
};

const questionsSchema = z.object({
  questions: z
    .array(
      z.object({
        requirement_ids: z.array(z.string()).default([]),
        prompt: z.string().min(1),
        answer_outline: z.string().default(""),
        difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(2),
      })
    )
    .default([]),
});

export interface GenerateQuestionsContext {
  roleTitle: string;
  companySummary: string;
  hiringProcessNotes: string;
  questionsPerRequirement: number;
}

function heuristicQuestions(
  category: QuestionCategory,
  requirements: Requirement[],
  perReq: number
): z.infer<typeof questionsSchema>["questions"] {
  const out: z.infer<typeof questionsSchema>["questions"] = [];
  for (const req of requirements) {
    for (let i = 0; i < perReq; i++) {
      const difficulty = req.priority === "must" ? (i === 0 ? 3 : 2) : 1;
      let prompt: string;
      if (category === "technical") {
        prompt = `Walk me through your hands-on experience with: "${req.text}". What is a non-trivial problem you solved with it?`;
      } else if (category === "behavioural") {
        prompt = `Tell me about a time your experience relevant to "${req.text}" was tested under pressure. What did you do?`;
      } else if (category === "system-design") {
        prompt = `Design a system where "${req.text}" is a core constraint. What are the key trade-offs?`;
      } else {
        prompt = `Given what this company does, how does your background in "${req.text}" line up with their needs?`;
      }
      out.push({
        requirement_ids: [req.id],
        prompt,
        answer_outline: `Cover: concrete example, the specific technique/behaviour tied to "${req.text}", measurable outcome, and what you'd do differently.`,
        difficulty,
      });
    }
  }
  return out;
}

export async function generateQuestionsForCategory(
  category: QuestionCategory,
  requirements: Requirement[],
  ctx: GenerateQuestionsContext
): Promise<Question[]> {
  if (requirements.length === 0) return [];

  const llm = getLLMClient();
  const reqList = requirements.map((r) => `- id=${r.id} (${r.priority}): ${r.text}`).join("\n");

  const result = await llm.completeJSON({
    task: `questions_${category}`,
    system: CATEGORY_SYSTEM_PROMPTS[category],
    user: [
      `Role: ${ctx.roleTitle || "unspecified"}`,
      ctx.companySummary ? fenceUntrusted("company_summary", ctx.companySummary) : "",
      ctx.hiringProcessNotes ? fenceUntrusted("hiring_process_notes", ctx.hiringProcessNotes) : "",
      `Generate ${ctx.questionsPerRequirement} question(s) for EACH of these requirements (reference the requirement's id in requirement_ids):`,
      reqList,
      `Respond with ONLY JSON: { "questions": [ { "requirement_ids": ["r1"], "prompt": string, "answer_outline": string, "difficulty": 1|2|3 } ] }`,
    ]
      .filter(Boolean)
      .join("\n\n"),
    temperature: 0.5,
    maxTokens: 1600,
    parse: (raw) => questionsSchema.parse(extractJson(raw)).questions,
    mockFallback: () => heuristicQuestions(category, requirements, ctx.questionsPerRequirement),
  });

  return result.map((q) => ({
    id: nextId("q"),
    requirement_ids: q.requirement_ids.length ? q.requirement_ids : requirements.map((r) => r.id).slice(0, 1),
    category,
    prompt: q.prompt,
    answer_outline: q.answer_outline,
    difficulty: q.difficulty,
    origin: "generated" as const,
    pinned: false,
  }));
}

/**
 * Maps a requirement to the question categories that should exist for it.
 * "domain" requirements are treated as company-fit material; "technical"
 * requirements also get a system-design pass when the hiring process is
 * known to include one, or the requirement/role reads as senior.
 */
export function categoriesForRequirement(
  req: Requirement,
  opts: { hiringMentionsSystemDesign: boolean; seniorRole: boolean }
): QuestionCategory[] {
  if (req.kind === "behavioural") return ["behavioural"];
  if (req.kind === "domain") return ["company-fit"];
  const cats: QuestionCategory[] = ["technical"];
  if (opts.hiringMentionsSystemDesign && (opts.seniorRole || req.priority === "must")) {
    cats.push("system-design");
  }
  return cats;
}
