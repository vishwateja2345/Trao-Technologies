import { env } from "../../config/env.js";
import type { LLMClient } from "./llmClient.js";
import { OpenRouterClient } from "./openRouterClient.js";
import { MockLLMClient } from "./mockClient.js";

let client: LLMClient | null = null;

export function getLLMClient(): LLMClient {
  if (!client) {
    client = env.LLM_PROVIDER === "openrouter" ? new OpenRouterClient() : new MockLLMClient();
  }
  return client;
}
