import { crawlCompanySite, type CrawlSkip, type CrawlResult } from "../retrieval/crawler.js";
import { searchInterviewDiscussion, type DiscussionSearchResult } from "../retrieval/discussionSearch.js";

const SYSTEM_DESIGN_KEYWORDS = /system[-\s]?design|architecture (round|interview)|scalab/i;

export interface ResearchResult {
  pages: CrawlResult["pages"];
  hiringUrls: string[];
  skipped: CrawlSkip[];
  hiringPageFound: boolean;
  discussion: DiscussionSearchResult;
  hiringProcessNotes: string;
  hiringMentionsSystemDesign: boolean;
  companyNameFallback: string;
}

export function deriveCompanyNameFallback(companyUrl: string): string {
  try {
    const host = new URL(companyUrl).hostname.replace(/^www\./, "");
    return host.split(".")[0];
  } catch {
    return companyUrl || "Unknown company";
  }
}

/**
 * Runs the two retrieval steps that inform generation (crawl + discussion
 * search). Extracted into one place so both the first-pass pipeline and a
 * later "regenerate the company brief" action use the exact same retrieval
 * code — never a second, slightly-different implementation.
 */
export async function researchCompany(companyUrl: string): Promise<ResearchResult> {
  const companyNameFallback = deriveCompanyNameFallback(companyUrl);
  let pages: ResearchResult["pages"] = [];
  let hiringUrls: string[] = [];
  let skipped: CrawlSkip[] = [];
  let hiringPageFound = false;

  if (companyUrl && companyUrl.trim()) {
    try {
      const crawl = await crawlCompanySite(companyUrl.trim());
      pages = crawl.pages;
      hiringUrls = crawl.hiringUrls;
      skipped = crawl.skipped;
      hiringPageFound = crawl.hiringPageFound;
    } catch {
      // crawlCompanySite already catches internally; this is a final safety net.
    }
  }

  const discussion = await searchInterviewDiscussion(pages[0]?.title || companyNameFallback);

  const hiringPagesText = pages
    .filter((p) => hiringUrls.includes(p.url))
    .map((p) => p.text)
    .join("\n");
  const discussionText = discussion.snippets.map((s) => `${s.title}: ${s.snippet}`).join("\n");
  const hiringProcessNotes = `${hiringPagesText}\n${discussionText}`.trim();

  return {
    pages,
    hiringUrls,
    skipped,
    hiringPageFound,
    discussion,
    hiringProcessNotes,
    hiringMentionsSystemDesign: SYSTEM_DESIGN_KEYWORDS.test(hiringProcessNotes),
    companyNameFallback,
  };
}
