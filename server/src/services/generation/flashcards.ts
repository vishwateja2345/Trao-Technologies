import { z } from "zod";
import { getLLMClient } from "./llmClientFactory.js";
import { extractJson } from "./jsonExtract.js";
import { nextId } from "../../utils/ids.js";
import type { Flashcard, Requirement } from "../../types/kit.js";

const flashcardsSchema = z.object({
  flashcards: z
    .array(
      z.object({
        requirement_id: z.string(),
        front: z.string().min(1),
        back: z.string().min(1),
      })
    )
    .default([]),
});

const SYSTEM_PROMPT = `You write concise interview-prep flashcards. Each
flashcard's "front" is a short prompt/question, and "back" is a crisp,
memorable answer or set of talking points (2-4 sentences max). Base every
card strictly on the requirement given; do not introduce unrelated facts.`;

function heuristicFlashcards(requirements: Requirement[]): z.infer<typeof flashcardsSchema>["flashcards"] {
  return requirements.map((r) => ({
    requirement_id: r.id,
    front: `Key talking point for: ${r.text}`,
    back: `Have a concrete, quantified example ready that demonstrates "${r.text}". Name the situation, your action, and the measurable result.`,
  }));
}

export async function generateFlashcards(requirements: Requirement[]): Promise<Flashcard[]> {
  if (requirements.length === 0) return [];
  const llm = getLLMClient();
  const reqList = requirements.map((r) => `- id=${r.id}: ${r.text}`).join("\n");

  const result = await llm.completeJSON({
    task: "flashcards",
    system: SYSTEM_PROMPT,
    user: `Create one flashcard for EACH requirement below.\n${reqList}\n\nRespond with ONLY JSON: { "flashcards": [ { "requirement_id": string, "front": string, "back": string } ] }`,
    temperature: 0.5,
    maxTokens: 1200,
    parse: (raw) => flashcardsSchema.parse(extractJson(raw)).flashcards,
    mockFallback: () => heuristicFlashcards(requirements),
  });

  return result.map((f) => ({
    id: nextId("f"),
    front: f.front,
    back: f.back,
    requirement_ids: [f.requirement_id],
    origin: "generated" as const,
    pinned: false,
  }));
}
