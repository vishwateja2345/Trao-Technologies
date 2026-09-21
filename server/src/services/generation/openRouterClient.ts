import { env } from "../../config/env.js";
import { withRetry, Throttle } from "../../utils/concurrency.js";
import { LLMGenerationError, type CompleteJSONParams, type LLMClient } from "./llmClient.js";

/**
 * Extracts a JSON object from raw model text. Models on free-tier instruct
 * models frequently wrap JSON in markdown fences or add a stray sentence
 * before/after — we strip fences and take the outermost balanced {...}
 * rather than failing on the first non-JSON character.
 */
export function extractJson(raw: string): unknown {
  let text = raw.trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) text = fenced[1].trim();

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("no JSON object found in model output");
  }
  const candidate = text.slice(start, end + 1);
  return JSON.parse(candidate);
}

const RETRYABLE_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

/**
 * Rate-limit handling: free-tier providers enforce tokens-per-minute, not
 * just requests-per-minute, and return 429 with (sometimes) a Retry-After
 * header. We throttle every call to a minimum spacing AND honour
 * Retry-After / exponential backoff on top of that, so a burst of
 * generation calls degrades to "slower" rather than "broken".
 */
export class OpenRouterClient implements LLMClient {
  private throttle = new Throttle(env.LLM_MIN_INTERVAL_MS);

  async completeJSON<T>(params: CompleteJSONParams<T>): Promise<T> {
    if (!env.OPENROUTER_API_KEY) {
      throw new LLMGenerationError(
        params.task,
        "OPENROUTER_API_KEY is not set but LLM_PROVIDER=openrouter. Set the key or use LLM_PROVIDER=mock."
      );
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
      `[openrouter] task=${params.task} giving up after retries, falling back to heuristic content: ${String(lastError)}`
    );
    return params.mockFallback();
  }

  private async callOnce(
    messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
    params: CompleteJSONParams<unknown>
  ): Promise<string> {
    return withRetry(
      async () => {
        const res = await fetch(`${env.OPENROUTER_BASE_URL}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
          },
          body: JSON.stringify({
            model: env.OPENROUTER_MODEL,
            temperature: params.temperature ?? 0.4,
            max_tokens: params.maxTokens ?? 1200,
            messages,
          }),
          signal: AbortSignal.timeout(45_000),
        });

        if (!res.ok) {
          const retryAfterHeader = res.headers.get("retry-after");
          const err: any = new Error(`OpenRouter HTTP ${res.status}`);
          err.status = res.status;
          err.retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : undefined;
          throw err;
        }

        const json = (await res.json()) as any;
        const content = json?.choices?.[0]?.message?.content;
        if (typeof content !== "string" || !content.trim()) {
          throw new Error("Empty completion from OpenRouter");
        }
        return content;
      },
      {
        retries: env.LLM_MAX_RETRIES,
        baseDelayMs: 1500,
        maxDelayMs: 20_000,
        isRetryable: (err: any) => RETRYABLE_STATUS.has(err?.status) || err?.name === "TimeoutError" || !err?.status,
        onRetry: (attempt, err: any, delay) => {
          console.warn(
            `[openrouter] retry ${attempt}/${env.LLM_MAX_RETRIES} after ${Math.round(delay)}ms (status=${err?.status ?? "network"})`
          );
        },
      }
    );
  }
}
