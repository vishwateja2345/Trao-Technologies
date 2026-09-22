/**
 * Small generic helpers used by both the retrieval layer (be polite to
 * company sites) and the LLM client (respect free-tier rate limits).
 */

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Serializes calls so that no two run less than `minIntervalMs` apart.
 * This is the "rate-limit your requests" requirement made concrete: a
 * single shared throttle instance per host (crawler) or per provider (LLM)
 * turns a burst of parallel calls into a polite, spaced-out sequence
 * instead of relying on every call site to remember to wait.
 */
export class Throttle {
  private queue: Promise<void> = Promise.resolve();
  private lastRun = 0;

  constructor(private readonly minIntervalMs: number) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    const runAfter = (async () => {
      await this.queue;
      const wait = Math.max(0, this.lastRun + this.minIntervalMs - Date.now());
      if (wait > 0) await sleep(wait);
      this.lastRun = Date.now();
    })();
    this.queue = runAfter;
    await runAfter;
    return fn();
  }
}

export interface RetryOptions {
  retries: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  isRetryable?: (err: unknown) => boolean;
  onRetry?: (attempt: number, err: unknown, delayMs: number) => void;
}

/** Exponential backoff with jitter, honouring a provider's Retry-After hint when present. */
export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions): Promise<T> {
  const { retries, baseDelayMs = 500, maxDelayMs = 15_000, isRetryable = () => true, onRetry } = opts;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === retries || !isRetryable(err)) throw err;
      const retryAfterMs = (err as { retryAfterMs?: number })?.retryAfterMs;
      let delay: number;
      if (typeof retryAfterMs === "number" && retryAfterMs > 0) {
        // The provider told us exactly how long to wait — respect that
        // over our own guess, capped so one bad hint can't stall forever.
        delay = Math.min(retryAfterMs, maxDelayMs * 2);
      } else {
        const exp = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
        delay = exp + Math.random() * exp * 0.3;
      }
      onRetry?.(attempt + 1, err, delay);
      await sleep(delay);
    }
  }
  throw lastErr;
}
