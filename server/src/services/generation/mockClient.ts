import { sleep } from "../../utils/concurrency.js";
import type { CompleteJSONParams, LLMClient } from "./llmClient.js";

/**
 * No-network implementation used when LLM_PROVIDER=mock (the default, so a
 * clean clone runs without any API key at all — see .env.example). It never
 * calls parse() on invented free text; it simply returns each call site's
 * deterministic `mockFallback`, which is built from the real, actual input
 * data (the JD, the requirement text, the crawled pages). This keeps the
 * rest of the pipeline — sequencing, coverage checking, scheduling,
 * validation — fully exercisable and testable without a key, while making
 * it obvious in the README that real submissions should run with
 * LLM_PROVIDER=openrouter and a real free-tier key.
 */
export class MockLLMClient implements LLMClient {
  async completeJSON<T>(params: CompleteJSONParams<T>): Promise<T> {
    await sleep(60 + Math.random() * 120); // simulate latency for realistic UI states
    return params.mockFallback();
  }
}
