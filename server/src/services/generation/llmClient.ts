/**
 * Generic contract every generation step programs against. Two
 * implementations exist: OpenRouterClient (real free-tier LLM calls) and
 * MockLLMClient (deterministic, no network, no key). Generation code never
 * branches on which one is active — every call site supplies a
 * `mockFallback` alongside the real prompt so the exact same pipeline code
 * runs in both modes; only the source of the content differs.
 */

export interface CompleteJSONParams<T> {
  /** Short label used in logs / error messages, e.g. "extract_requirements". */
  task: string;
  system: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
  /** Parses + validates the raw model text. Throw to trigger a repair retry. */
  parse: (raw: string) => T;
  /** Deterministic, non-LLM fallback used only when LLM_PROVIDER=mock. */
  mockFallback: () => T;
}

export interface LLMClient {
  completeJSON<T>(params: CompleteJSONParams<T>): Promise<T>;
}

export class LLMGenerationError extends Error {
  constructor(public task: string, message: string, public cause?: unknown) {
    super(message);
    this.name = "LLMGenerationError";
  }
}
