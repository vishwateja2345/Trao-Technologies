import * as cheerio from "cheerio";
import { env } from "../../config/env.js";
import { assertSafeUrl } from "./urlSafety.js";
import { isAllowedByRobots } from "./robots.js";
import { withRetry } from "../../utils/concurrency.js";

export interface FetchedPage {
  url: string;
  title: string;
  text: string;
  links: Array<{ href: string; text: string }>;
  contentType: string;
}

export type FetchFailureCode =
  | "invalid_url"
  | "blocked_private_address"
  | "robots_disallowed"
  | "unsupported_content_type"
  | "too_large"
  | "timeout"
  | "http_error"
  | "network_error";

export class FetchFailure extends Error {
  constructor(public code: FetchFailureCode, message: string) {
    super(message);
    this.name = "FetchFailure";
  }
}

const ALLOWED_CONTENT_TYPES = ["text/html", "application/xhtml+xml"];

/**
 * Fetches a single page and reduces it to readable text + outgoing links.
 * Every retrieval requirement in Section 11 (validate URLs, restrict
 * content-type/size, treat page content as data not instructions) is
 * enforced right here, once, so every caller gets it for free.
 */
export async function fetchAndClean(rawUrl: string): Promise<FetchedPage> {
  const safety = await assertSafeUrl(rawUrl);
  if (!safety.ok) {
    throw new FetchFailure(
      safety.reason === "private_address_blocked" || safety.reason === "loopback_blocked"
        ? "blocked_private_address"
        : "invalid_url",
      `URL failed safety check: ${safety.reason}`
    );
  }
  const url = safety.normalizedUrl!;

  const allowed = await isAllowedByRobots(url);
  if (!allowed) {
    throw new FetchFailure("robots_disallowed", `Disallowed by robots.txt: ${url}`);
  }

  const res = await withRetry(
    () =>
      fetch(url, {
        signal: AbortSignal.timeout(env.CRAWL_TIMEOUT_MS),
        headers: {
          "User-Agent": env.CRAWL_USER_AGENT,
          Accept: "text/html,application/xhtml+xml",
        },
        redirect: "follow",
      }),
    {
      retries: 2,
      baseDelayMs: 400,
      isRetryable: (err) => !(err instanceof FetchFailure),
    }
  ).catch((err) => {
    if (err?.name === "TimeoutError") throw new FetchFailure("timeout", `Timed out fetching ${url}`);
    throw new FetchFailure("network_error", `Network error fetching ${url}: ${String(err)}`);
  });

  if (!res.ok) {
    throw new FetchFailure("http_error", `HTTP ${res.status} fetching ${url}`);
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (!ALLOWED_CONTENT_TYPES.some((t) => contentType.includes(t))) {
    throw new FetchFailure("unsupported_content_type", `Unexpected content-type: ${contentType}`);
  }

  const contentLength = Number(res.headers.get("content-length") ?? 0);
  if (contentLength && contentLength > env.CRAWL_MAX_BYTES) {
    throw new FetchFailure("too_large", `Page too large: ${contentLength} bytes`);
  }

  // Stream-cap the body even when no content-length header is present.
  const reader = res.body?.getReader();
  let received = 0;
  const chunks: Uint8Array[] = [];
  if (reader) {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.length;
      if (received > env.CRAWL_MAX_BYTES) {
        await reader.cancel();
        throw new FetchFailure("too_large", "Page exceeded max byte cap while streaming");
      }
      chunks.push(value);
    }
  }
  const html = Buffer.concat(chunks).toString("utf-8");

  const $ = cheerio.load(html);
  $("script, style, noscript, svg, iframe").remove();

  const title = $("title").first().text().trim();

  const links: Array<{ href: string; text: string }> = [];
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    const text = $(el).text().trim().replace(/\s+/g, " ");
    if (href) links.push({ href, text });
  });

  const text = $("body")
    .text()
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 20_000);

  return { url, title, text, links, contentType };
}
