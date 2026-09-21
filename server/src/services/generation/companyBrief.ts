import { z } from "zod";
import { getLLMClient } from "./llmClientFactory.js";
import { extractJson } from "./openRouterClient.js";
import { fenceUntrusted } from "./promptSafety.js";
import type { FetchedPage } from "../retrieval/fetchPage.js";

/**
 * Step: "Crawl a company site and ... generate a company brief." Runs after
 * crawling, because a homepage genuinely needs to be fetched before this
 * step has anything to summarise (brief Section 3's sequencing point).
 */

const briefSchema = z.object({
  company: z.string().default(""),
  summary: z.string().default(""),
  what_they_do: z.string().default(""),
});

export interface CompanyBriefResult {
  company: string;
  summary: string;
  what_they_do: string;
}

const SYSTEM_PROMPT = `You summarise a company from crawled web pages for someone
preparing for an interview there. Use ONLY facts present in the provided
pages. If the pages give little or no real information, say so plainly
instead of inventing a generic-sounding description ("a fast-growing
innovative company" for a site with almost no content is worse than
admitting little was found).

Respond with ONLY a JSON object of this exact shape:
{ "company": string, "summary": string, "what_they_do": string }`;

function heuristicBrief(pages: FetchedPage[], fallbackName: string): CompanyBriefResult {
  const homepage = pages[0];
  if (!homepage || !homepage.text || homepage.text.length < 40) {
    return {
      company: fallbackName,
      summary: "Little public information could be retrieved about this company from its website.",
      what_they_do: "",
    };
  }
  const snippet = homepage.text.slice(0, 500);
  return {
    company: homepage.title || fallbackName,
    summary: snippet,
    what_they_do: snippet.slice(0, 240),
  };
}

export async function generateCompanyBrief(
  pages: FetchedPage[],
  fallbackName: string
): Promise<CompanyBriefResult> {
  if (pages.length === 0) {
    return {
      company: fallbackName,
      summary: "The company website could not be retrieved, so no brief could be generated from it.",
      what_they_do: "",
    };
  }

  const llm = getLLMClient();
  const pagesText = pages
    .slice(0, 4)
    .map((p, i) => fenceUntrusted(`page_${i + 1}:${p.url}`, `${p.title}\n${p.text}`.slice(0, 3000)))
    .join("\n\n");

  return llm.completeJSON({
    task: "company_brief",
    system: SYSTEM_PROMPT,
    user: `Company website candidate name: ${fallbackName}\n\n${pagesText}`,
    temperature: 0.3,
    maxTokens: 700,
    parse: (raw) => briefSchema.parse(extractJson(raw)),
    mockFallback: () => heuristicBrief(pages, fallbackName),
  });
}
