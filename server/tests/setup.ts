process.env.LLM_PROVIDER = process.env.LLM_PROVIDER ?? "mock";
process.env.ALLOW_PRIVATE_HOSTS = process.env.ALLOW_PRIVATE_HOSTS ?? "true";
process.env.CRAWL_TIMEOUT_MS = process.env.CRAWL_TIMEOUT_MS ?? "3000";
process.env.MONGODB_URI = process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/ai-interview-prep-kit-test";
process.env.JWT_SECRET = process.env.JWT_SECRET ?? "test-secret-not-for-production-use-only";
