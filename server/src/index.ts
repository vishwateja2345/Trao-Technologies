import { createApp } from "./app.js";
import { connectDB } from "./config/db.js";
import { env, assertProductionSecrets } from "./config/env.js";

async function main() {
  assertProductionSecrets();
  await connectDB();
  const app = createApp();
  app.listen(env.PORT, () => {
    console.log(`AI Interview Prep Kit API listening on :${env.PORT} (llm=${env.LLM_PROVIDER})`);
  });
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
