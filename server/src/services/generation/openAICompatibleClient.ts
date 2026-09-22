import { withRetry, Throttle } from "../../utils/concurrency.js";
import type { CompleteJSONParams, LLMClient } from "./llmClient.js";

const RETRYABLE_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

export interface OpenAICompatibleConfig {
  /** Short label used in logs, e.g. "openrouter" or "deepseek". */
  providerName: string;
  baseUrl: string;
  apiKey: string | undefined;
  model: string;
  minIntervalMs: number;
  maxRetries: number;
}

/**
 * Client for any provider that speaks the OpenAI chat-completions shape —
 * which covers both supported providers (OpenRouter and DeepSeek) with one
 * implementation. Rate-limit handling: free tiers enforce tokens-per-minute,
 * not just requests-per-minute, and return 429 with (sometimes) a
 * Retry-After header. Every call is throttled to a minimum spacing AND
 * backs off exponentially (honouring Retry-After when the provider sends
 * one — see utils/concurrency.ts) on top of that, so a burst of generation
 * calls degrades to "slower", never "broken".
 */
export class OpenAICompatibleClient implements LLMClient {
  private throttle: Throttle;

  constructor(private config: OpenAICompatibleConfig) {
    this.throttle = new Throttle(config.minIntervalMs);
  }

  async completeJSON<T>(params: CompleteJSONParams<T>): Promise<T> {
    if (!this.config.apiKey) {
      console.error(
        `[${this.config.providerName}] no API key configured for task=${params.task}; falling back to heuristic content.`
      );
      return params.mockFallback();
    }

    const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: params.system },
      { role: "user", content: params.user },
    ];

    let lastError: unknown;
    for (let repairAttempt = 0; repairAttempt <= 2; repairAttempt++) {
      try {
        const raw = await this.throttle.run(() => this.callOnce(messages, params));
        return params.parse(raw);
      } catch (err) {
        lastError = err;
        messages.push({
          role: "user",
          content:
            "Your previous response could not be parsed as valid JSON matching the requested schema. " +
            "Reply again with ONLY a single valid JSON object, no markdown fences, no commentary.",
        });
      }
    }

    // The provider is persistently rate-limited, down, or returning
    // unparsable output even after retries + repair prompts. Rather than
    // failing the whole kit (Section 10: "the model returns invalid JSON
    // or an incomplete kit" / "your LLM provider rate-limits you, or
    // briefly fails"), degrade to the same deterministic heuristic used in
    // mock mode so the pipeline still produces a structurally valid,
    // honestly-labelled result.
    console.error(
      `[${this.config.providerName}] task=${params.task} giving up after retries, falling back to heuristic content: ${String(lastError)}`
    );
    return params.mockFallback();
  }

  private async callOnce(
    messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
    params: CompleteJSONParams<unknown>
  ): Promise<string> {
    const { providerName, baseUrl, apiKey, model, maxRetries } = this.config;
    return withRetry(
      async () => {
        const res = await fetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            temperature: params.temperature ?? 0.4,
            max_tokens: params.maxTokens ?? 1200,
            messages,
          }),
          signal: AbortSignal.timeout(45_000),
        });

        if (!res.ok) {
          const retryAfterHeader = res.headers.get("retry-after");
          const err: any = new Error(`${providerName} HTTP ${res.status}`);
          err.status = res.status;
          err.retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : undefined;
          throw err;
        }

        const json = (await res.json()) as any;
        const content = json?.choices?.[0]?.message?.content;
        if (typeof content !== "string" || !content.trim()) {
          throw new Error(`Empty completion from ${providerName}`);
        }
        return content;
      },
      {
        retries: maxRetries,
        baseDelayMs: 1500,
        maxDelayMs: 20_000,
        isRetryable: (err: any) => RETRYABLE_STATUS.has(err?.status) || err?.name === "TimeoutError" || !err?.status,
        onRetry: (attempt, err: any, delay) => {
          console.warn(
            `[${providerName}] retry ${attempt}/${maxRetries} after ${Math.round(delay)}ms (status=${err?.status ?? "network"})`
          );
        },
      }
    );
  }
}
