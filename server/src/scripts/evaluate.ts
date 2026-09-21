import { readFile, writeFile } from "node:fs/promises";
import pLimit from "p-limit";
import { z } from "zod";
import { runPipeline, PipelineFatalError } from "../pipeline/generateKit.js";

/**
 * Mandatory batch entry point (brief Section 9):
 *   npm run evaluate -- --input <cases.json> --output <kits.json>
 *
 * Runs the exact same `runPipeline` the HTTP API uses (imported straight
 * from src/pipeline, not re-implemented). Needs no database — it reads
 * cases, runs retrieval + generation + validation in memory, and writes one
 * JSON file. Each case is isolated in its own try/catch so one bad case
 * (unreachable company, malformed input) never aborts the run.
 */

const caseSchema = z.object({
  id: z.string().min(1),
  jd: z.string(),
  company_url: z.string(),
  days: z.coerce.number().int().min(1).max(120),
});

function parseArgs(argv: string[]): { input: string; output: string } {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--input") args.input = argv[++i];
    else if (argv[i] === "--output") args.output = argv[++i];
  }
  if (!args.input || !args.output) {
    console.error("Usage: npm run evaluate -- --input <cases.json> --output <kits.json>");
    process.exit(1);
  }
  return { input: args.input, output: args.output };
}

function errorCodeFor(err: unknown): string {
  if (err instanceof PipelineFatalError) return err.code;
  return "UNEXPECTED_ERROR";
}

async function runCase(c: z.infer<typeof caseSchema>) {
  try {
    const result = await runPipeline({ jd: c.jd, companyUrl: c.company_url, days: c.days });
    return { id: c.id, status: "ok" as const, kit: result.kit, error: null };
  } catch (err) {
    console.error(`Case ${c.id} failed:`, err);
    return {
      id: c.id,
      status: "failed" as const,
      kit: null,
      error: { code: errorCodeFor(err), message: err instanceof Error ? err.message : String(err) },
    };
  }
}

async function main() {
  const { input, output } = parseArgs(process.argv.slice(2));

  const raw = JSON.parse(await readFile(input, "utf-8"));
  const parsed = z.array(caseSchema).safeParse(raw);
  if (!parsed.success) {
    console.error("Invalid input file:", parsed.error.flatten());
    process.exit(1);
  }
  const cases = parsed.data;

  // Modest concurrency: the LLM client's own throttle already serialises
  // real network calls globally, so running a few cases "in parallel" here
  // mostly overlaps crawl I/O rather than overwhelming the provider.
  const limit = pLimit(3);
  const startedAt = Date.now();
  const kits = await Promise.all(cases.map((c) => limit(() => runCase(c))));
  const elapsedMs = Date.now() - startedAt;

  const okCount = kits.filter((k) => k.status === "ok").length;
  console.log(`Processed ${cases.length} case(s) in ${(elapsedMs / 1000).toFixed(1)}s — ${okCount} ok, ${cases.length - okCount} failed.`);

  const outputDoc = {
    version: "1.0",
    generated_at: new Date().toISOString(),
    kits,
  };
  await writeFile(output, JSON.stringify(outputDoc, null, 2), "utf-8");
  console.log(`Wrote ${output}`);
}

main().catch((err) => {
  console.error("Fatal batch error:", err);
  process.exit(1);
});
