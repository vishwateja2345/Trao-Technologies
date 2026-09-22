import "dotenv/config";
import { z } from "zod";

/**
 * All configuration is read once at boot and validated. Failing fast on a
 * missing/invalid env var is cheaper than failing halfway through a crawl.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  // Defaulted (not required) so `npm run evaluate` works from a clean clone
  // with zero setup — the batch entry point never touches MongoDB at all.
  MONGODB_URI: z.string().default("mongodb://127.0.0.1:27017/ai-interview-prep-kit"),
  JWT_SECRET: z
    .string()
    .default("dev-only-insecure-secret-change-me-before-deploying-1234"),
  JWT_EXPIRES_IN: z.string().default("7d"),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),

  // LLM provider. "mock" needs no key and is used for local dev / CI so the
  // rest of the pipeline can be built and tested without burning quota.
  LLM_PROVIDER: z.enum(["openrouter", "deepseek", "mock"]).default("mock"),
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_MODEL: z.string().default("nvidia/nemotron-3-super-120b-a12b:free"),
  OPENROUTER_BASE_URL: z.string().default("https://openrouter.ai/api/v1"),

  DEEPSEEK_API_KEY: z.string().optional(),
  DEEPSEEK_MODEL: z.string().default("deepseek-chat"),
  DEEPSEEK_BASE_URL: z.string().default("https://api.deepseek.com"),

  // Retrieval / security
  ALLOW_PRIVATE_HOSTS: z
    .string()
    .default("false")
    .transform((v) => v === "true"),
  CRAWL_MAX_PAGES: z.coerce.number().default(6),
  CRAWL_TIMEOUT_MS: z.coerce.number().default(8000),
  CRAWL_MAX_BYTES: z.coerce.number().default(1_500_000),
  CRAWL_USER_AGENT: z
    .string()
    .default("AIInterviewPrepKitBot/1.0 (+https://example.com/bot)"),

  // Generation limits
  MAX_COVERAGE_PASSES: z.coerce.number().default(2),
  LLM_MAX_RETRIES: z.coerce.number().default(4),
  LLM_MIN_INTERVAL_MS: z.coerce.number().default(1500),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
    throw new Error("Invalid environment configuration");
  }
  return parsed.data;
}

export const env = loadEnv();

const DEFAULT_JWT_SECRET = "dev-only-insecure-secret-change-me-before-deploying-1234";

/** Called only by the long-running server entrypoint, never by the batch script. */
export function assertProductionSecrets(): void {
  if (env.NODE_ENV === "production" && env.JWT_SECRET === DEFAULT_JWT_SECRET) {
    throw new Error("JWT_SECRET must be set to a real secret in production. See .env.example.");
  }
}

