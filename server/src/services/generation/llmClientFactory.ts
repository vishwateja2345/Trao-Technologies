import { env } from "../../config/env.js";
import type { LLMClient } from "./llmClient.js";
import { OpenAICompatibleClient } from "./openAICompatibleClient.js";
import { MockLLMClient } from "./mockClient.js";

let client: LLMClient | null = null;

export function getLLMClient(): LLMClient {
  if (!client) {
    if (env.LLM_PROVIDER === "openrouter") {
      client = new OpenAICompatibleClient({
        providerName: "openrouter",
        baseUrl: env.OPENROUTER_BASE_URL,
        apiKey: env.OPENROUTER_API_KEY,
        model: env.OPENROUTER_MODEL,
        minIntervalMs: env.LLM_MIN_INTERVAL_MS,
        maxRetries: env.LLM_MAX_RETRIES,
      });
    } else if (env.LLM_PROVIDER === "deepseek") {
      client = new OpenAICompatibleClient({
        providerName: "deepseek",
        baseUrl: env.DEEPSEEK_BASE_URL,
        apiKey: env.DEEPSEEK_API_KEY,
        model: env.DEEPSEEK_MODEL,
        minIntervalMs: env.LLM_MIN_INTERVAL_MS,
        maxRetries: env.LLM_MAX_RETRIES,
      });
    } else {
      client = new MockLLMClient();
    }
  }
  return client;
}
