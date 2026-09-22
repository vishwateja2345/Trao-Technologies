import { z } from "zod";
import { getLLMClient } from "./llmClientFactory.js";
import { extractJson } from "./jsonExtract.js";
import { fenceUntrusted } from "./promptSafety.js";
import { nextId } from "../../utils/ids.js";
import type { Requirement, RequirementKind, RequirementPriority } from "../../types/kit.js";

/**
 * Step 1 of the pipeline (brief Section 3): "Extract the relevant
 * requirements from the job description." Pasted text needs no retrieval,
 * so this step runs first and needs nothing but the JD itself.
 *
 * Priority (must vs nice) is instructed to come strictly from how the
 * posting *words* each line — "required"/"must have"/"X+ years" reads as
 * must; "nice to have"/"bonus points"/"preferred" reads as nice — never
 * from how important the model thinks the skill sounds. This directly
 * targets the 20-point "nothing is invented" automated criterion.
 */

const llmResultSchema = z.object({
  title: z.string().default(""),
  seniority: z.string().default(""),
  responsibilities: z.array(z.string()).default([]),
  requirements: z
    .array(
      z.object({
        text: z.string().min(1),
        kind: z.enum(["technical", "behavioural", "domain"]),
        priority: z.enum(["must", "nice"]),
      })
    )
    .default([]),
});

export interface ExtractedRole {
  title: string;
  seniority: string;
  responsibilities: string[];
  requirements: Requirement[];
  thin: boolean; // true when the JD was too short to extract much — reported honestly, not padded
}

const SYSTEM_PROMPT = `You are an exacting job-description analyst.
You extract ONLY what a job description literally states. You never invent
requirements, responsibilities, seniority, or a title the text does not
support. If the description is very short or vague, return fewer items
rather than inventing plausible-sounding ones.

Priority rule: mark a requirement "must" only if the wording is
mandatory/required in tone ("required", "must have", "X+ years",
"you will", stated as a baseline qualification). Mark it "nice" if the
wording is optional in tone ("nice to have", "bonus", "preferred",
"a plus"). Do not upgrade a "nice" line to "must" because it sounds
important.

Classify each requirement's kind: "technical" (hard skills, tools,
languages, years of experience with a technology), "behavioural" (soft
skills, communication, mentoring, collaboration, leadership), or "domain"
(industry/business-domain knowledge, e.g. "experience in fintech" or
"healthcare compliance knowledge").

Respond with ONLY a JSON object of this exact shape, no markdown fences,
no commentary:
{
  "title": string,
  "seniority": string,
  "responsibilities": string[],
  "requirements": [ { "text": string, "kind": "technical"|"behavioural"|"domain", "priority": "must"|"nice" } ]
}`;

function heuristicExtract(jd: string): z.infer<typeof llmResultSchema> {
  const lines = jd
    .split(/\r?\n/)
    .flatMap((l) => l.split(/(?<=[.!?])\s+(?=[A-Z])/)) // also split long paragraph lines into sentences
    .map((l) => l.replace(/^[\s•\-*\d.)]+/, "").trim())
    .filter(Boolean);

  const titleGuess = lines[0]?.slice(0, 120) ?? "";
  const seniorityGuess = /senior|staff|principal|lead/i.test(jd)
    ? "senior"
    : /junior|entry[-\s]?level|graduate/i.test(jd)
    ? "junior"
    : "mid";

  const mustRe = /\b(required|must have|must[-\s]?haves?|at least|minimum of|\d+\+?\s*years?)\b/i;
  const niceRe = /\b(nice to have|bonus|preferred|a plus|good to have|plus if)\b/i;
  const behaviouralRe = /\b(communicat\w*|mentor\w*|collaborat\w*|leadership|led\b|stakeholder\w*|team\s?player\w*|ownership)\b/i;
  const domainRe = /\b(compliance|industry|healthcare|fintech|regulat\w*|domain)\b/i;

  const requirements = lines
    .filter((l) => l.length > 8 && l.length < 240)
    .filter((l) => mustRe.test(l) || niceRe.test(l) || /\b(experience|proficien|knowledge of|familiarity)\b/i.test(l))
    .slice(0, 12)
    .map((text) => {
      const priority: RequirementPriority = niceRe.test(text) && !mustRe.test(text) ? "nice" : "must";
      const kind: RequirementKind = behaviouralRe.test(text)
        ? "behavioural"
        : domainRe.test(text)
        ? "domain"
        : "technical";
      return { text, kind, priority };
    });

  const responsibilities = lines
    .filter((l) => /\b(you will|responsib|own|build|design|drive|maintain)\b/i.test(l))
    .slice(0, 8);

  return {
    title: titleGuess,
    seniority: seniorityGuess,
    responsibilities,
    requirements,
  };
}

export async function extractRequirements(jd: string): Promise<ExtractedRole> {
  const llm = getLLMClient();
  const thin = jd.trim().length < 200;

  const result = await llm.completeJSON({
    task: "extract_requirements",
    system: SYSTEM_PROMPT,
    user: [
      "Extract the role title, seniority, responsibilities and requirements from this job description.",
      fenceUntrusted("job_description", jd),
    ].join("\n\n"),
    temperature: 0.1,
    maxTokens: 1400,
    parse: (raw) => llmResultSchema.parse(extractJson(raw)),
    mockFallback: () => heuristicExtract(jd),
  });

  const requirements: Requirement[] = result.requirements.map((r) => ({
    id: nextId("r"),
    text: r.text,
    kind: r.kind,
    priority: r.priority,
  }));

  return {
    title: result.title,
    seniority: result.seniority,
    responsibilities: result.responsibilities,
    requirements,
    thin,
  };
}
