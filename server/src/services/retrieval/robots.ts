import { createRequire } from "node:module";
import { env } from "../../config/env.js";
import { assertSafeUrl } from "./urlSafety.js";

interface RobotsParserResult {
  isAllowed(url: string, ua?: string): boolean | undefined;
}

// robots-parser ships a malformed .d.ts (a stray ambient module declaration
// followed by an unrelated default export), so TypeScript can't resolve a
// usable type from a normal `import`. CJS interop via createRequire sidesteps
// that entirely and is safe here since this file only runs under Node.
const require = createRequire(import.meta.url);
const robotsParser = require("robots-parser") as (url: string, txt: string) => RobotsParserResult;

const robotsCache = new Map<string, { fetchedAt: number; parser: RobotsParserResult | null }>();
const ROBOTS_TTL_MS = 10 * 60 * 1000;

async function getRobots(origin: string) {
  const cached = robotsCache.get(origin);
  if (cached && Date.now() - cached.fetchedAt < ROBOTS_TTL_MS) return cached.parser;

  const robotsUrl = `${origin}/robots.txt`;
  try {
    const check = await assertSafeUrl(robotsUrl);
    if (!check.ok) {
      robotsCache.set(origin, { fetchedAt: Date.now(), parser: null });
      return null;
    }
    const res = await fetch(robotsUrl, {
      signal: AbortSignal.timeout(env.CRAWL_TIMEOUT_MS),
      headers: { "User-Agent": env.CRAWL_USER_AGENT },
    });
    if (!res.ok) {
      robotsCache.set(origin, { fetchedAt: Date.now(), parser: null });
      return null;
    }
    const body = await res.text();
    const parser = robotsParser(robotsUrl, body);
    robotsCache.set(origin, { fetchedAt: Date.now(), parser });
    return parser;
  } catch {
    // No robots.txt, or it failed to load — treat as "no restrictions found"
    // rather than blocking the crawl outright.
    robotsCache.set(origin, { fetchedAt: Date.now(), parser: null });
    return null;
  }
}

export async function isAllowedByRobots(url: string): Promise<boolean> {
  try {
    const parsed = new URL(url);
    const origin = `${parsed.protocol}//${parsed.host}`;
    const parser = await getRobots(origin);
    if (!parser) return true;
    return parser.isAllowed(url, env.CRAWL_USER_AGENT) !== false;
  } catch {
    return true;
  }
}
