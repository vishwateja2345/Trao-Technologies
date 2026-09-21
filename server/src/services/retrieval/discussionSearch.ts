import * as cheerio from "cheerio";
import { env } from "../../config/env.js";
import { withRetry, Throttle } from "../../utils/concurrency.js";

/**
 * Looks for public discussion of a company's interview process. There is no
 * free, keyless "interview process" API, so we use DuckDuckGo's keyless HTML
 * search endpoint as a lightweight discovery source and read the result
 * snippets shown on the results page itself (we deliberately do not crawl
 * each hit — that would multiply our request budget and rate-limit risk for
 * marginal benefit within this assessment's scope).
 *
 * This is best-effort: if the search endpoint is unreachable, rate-limited,
 * or returns nothing, we report an empty result rather than fail the run
 * (Section 10: "public discussion turns up nothing at all" is an expected,
 * honestly-reported outcome, not an error).
 */

export interface DiscussionSnippet {
  title: string;
  snippet: string;
  url: string;
}

export interface DiscussionSearchResult {
  query: string;
  snippets: DiscussionSnippet[];
  searched: boolean;
  error?: string;
}

const searchThrottle = new Throttle(1200);

export async function searchInterviewDiscussion(companyName: string): Promise<DiscussionSearchResult> {
  const query = `${companyName} interview process questions`;
  if (!companyName.trim()) {
    return { query, snippets: [], searched: false, error: "no_company_name" };
  }

  const endpoint = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

  try {
    const html = await searchThrottle.run(() =>
      withRetry(
        async () => {
          const res = await fetch(endpoint, {
            signal: AbortSignal.timeout(env.CRAWL_TIMEOUT_MS),
            headers: {
              "User-Agent": env.CRAWL_USER_AGENT,
              Accept: "text/html",
            },
          });
          if (res.status === 429) throw new Error("rate_limited");
          if (!res.ok) throw new Error(`http_${res.status}`);
          return res.text();
        },
        { retries: 2, baseDelayMs: 800 }
      )
    );

    const $ = cheerio.load(html);
    const snippets: DiscussionSnippet[] = [];
    $(".result").each((_, el) => {
      if (snippets.length >= 5) return;
      const title = $(el).find(".result__title").text().trim().replace(/\s+/g, " ");
      const snippet = $(el).find(".result__snippet").text().trim().replace(/\s+/g, " ");
      const href = $(el).find(".result__a").attr("href") ?? "";
      if (title || snippet) snippets.push({ title, snippet, url: href });
    });

    return { query, snippets, searched: true };
  } catch (err) {
    return { query, snippets: [], searched: false, error: String((err as Error)?.message ?? err) };
  }
}
