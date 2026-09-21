import { fetchAndClean, FetchFailure, type FetchedPage } from "./fetchPage.js";
import { Throttle } from "../../utils/concurrency.js";
import { env } from "../../config/env.js";

/**
 * Finding the hiring page is "the interesting half" of retrieval (brief,
 * Section 2). We don't hard-code paths like /careers — instead we crawl the
 * homepage, score every discovered link by how much its URL and anchor text
 * look like a hiring/about/culture page, and fetch the highest-scoring
 * candidates. This generalises to whatever path a given company happens to
 * use (/jobs, /handbook, an engineering blog post, a Greenhouse/Lever board).
 */

const HIRING_KEYWORDS: Array<{ re: RegExp; weight: number }> = [
  {
    re: /\b(careers?|jobs?|join[-\s]?(us|our[-\s]?team|the[-\s]?team)|we(’|'|are|['\u2019]re)?[-\s]?hiring|hiring|open[-\s]?(roles?|positions?)|work[-\s]?with[-\s]?us|work[-\s]?here)\b/i,
    weight: 12,
  },
  { re: /\b(interview(ing)?[-\s]?process|our[-\s]?hiring|how[-\s]?we[-\s]?hire|recruit(ing|ment)?)\b/i, weight: 9 },
  { re: /\b(life[-\s]?at|culture|benefits?|perks?)\b/i, weight: 5 },
  { re: /\b(handbook)\b/i, weight: 6 },
  { re: /\b(engineering[-\s]?blog|eng[-\s]?blog|tech[-\s]?blog)\b/i, weight: 4 },
];

const ABOUT_KEYWORDS: Array<{ re: RegExp; weight: number }> = [
  { re: /\b(about([-\s]?us)?|company|who[-\s]?we[-\s]?are|mission|story)\b/i, weight: 8 },
  { re: /\b(team|leadership|values)\b/i, weight: 4 },
];

// Common third-party applicant-tracking-system domains. Companies frequently
// host their entire careers site off-domain, so a same-origin-only crawl
// would miss it entirely.
const ATS_HOST_HINTS = [
  "greenhouse.io",
  "lever.co",
  "ashbyhq.com",
  "workday.com",
  "smartrecruiters.com",
  "bamboohr.com",
  "breezy.hr",
  "recruitee.com",
];

function scoreLink(url: URL, anchorText: string, sameOrigin: boolean): { score: number; kind: "hiring" | "about" | "other" } {
  const haystack = `${url.pathname} ${url.hostname} ${anchorText}`.toLowerCase();
  let hiringScore = 0;
  let aboutScore = 0;
  for (const { re, weight } of HIRING_KEYWORDS) if (re.test(haystack)) hiringScore += weight;
  for (const { re, weight } of ABOUT_KEYWORDS) if (re.test(haystack)) aboutScore += weight;

  if (!sameOrigin) {
    if (ATS_HOST_HINTS.some((h) => url.hostname.includes(h))) {
      hiringScore += 12; // strong signal: dedicated hiring platform
    } else {
      // Cross-origin links that aren't a known ATS are usually unrelated
      // (social media, partner logos, footers) — heavily discount them.
      hiringScore -= 20;
      aboutScore -= 20;
    }
  }

  // Prefer shallow paths over deep ones (a top-level /careers beats a
  // buried /2019/03/12/some-post) as a mild tie-breaker.
  const depthPenalty = Math.max(0, url.pathname.split("/").filter(Boolean).length - 1) * 0.5;

  if (hiringScore >= aboutScore && hiringScore > 0) return { score: hiringScore - depthPenalty, kind: "hiring" };
  if (aboutScore > 0) return { score: aboutScore - depthPenalty, kind: "about" };
  return { score: -depthPenalty, kind: "other" };
}

export interface CrawlSkip {
  url: string;
  reason: string;
}

export interface CrawlResult {
  pages: FetchedPage[];
  hiringPageFound: boolean;
  hiringUrls: string[];
  aboutUrls: string[];
  skipped: CrawlSkip[];
}

export async function crawlCompanySite(startUrl: string): Promise<CrawlResult> {
  const skipped: CrawlSkip[] = [];
  const pages: FetchedPage[] = [];
  const throttle = new Throttle(300);

  let homepage: FetchedPage;
  try {
    homepage = await throttle.run(() => fetchAndClean(startUrl));
    pages.push(homepage);
  } catch (err) {
    const reason = err instanceof FetchFailure ? err.code : "network_error";
    skipped.push({ url: startUrl, reason });
    return { pages, hiringPageFound: false, hiringUrls: [], aboutUrls: [], skipped };
  }

  const origin = new URL(homepage.url).origin;
  const seen = new Set<string>([homepage.url]);
  const candidates: Array<{ url: URL; score: number; kind: "hiring" | "about" | "other" }> = [];

  for (const link of homepage.links) {
    let absolute: URL;
    try {
      absolute = new URL(link.href, homepage.url);
    } catch {
      continue;
    }
    if (!["http:", "https:"].includes(absolute.protocol)) continue;
    absolute.hash = "";
    const key = absolute.toString();
    if (seen.has(key)) continue;
    seen.add(key);

    const sameOrigin = absolute.origin === origin;
    const { score, kind } = scoreLink(absolute, link.text, sameOrigin);
    if (kind !== "other" && score > 0) {
      candidates.push({ url: absolute, score, kind });
    }
  }

  candidates.sort((a, b) => b.score - a.score);

  const budget = Math.max(0, env.CRAWL_MAX_PAGES - 1);
  const hiringUrls: string[] = [];
  const aboutUrls: string[] = [];
  let fetched = 0;

  for (const candidate of candidates) {
    if (fetched >= budget) break;
    try {
      const page = await throttle.run(() => fetchAndClean(candidate.url.toString()));
      pages.push(page);
      fetched++;
      if (candidate.kind === "hiring") hiringUrls.push(page.url);
      else aboutUrls.push(page.url);
    } catch (err) {
      const reason = err instanceof FetchFailure ? err.code : "network_error";
      skipped.push({ url: candidate.url.toString(), reason });
      // A page we can't retrieve is reported, not fatal — keep going.
    }
  }

  return {
    pages,
    hiringPageFound: hiringUrls.length > 0,
    hiringUrls,
    aboutUrls,
    skipped,
  };
}
