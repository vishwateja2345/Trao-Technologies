import { Spinner } from "@/components/ui/Spinner";
import type { GenerationStep } from "@/lib/types";

const STEP_LABELS: Record<string, string> = {
  extract_requirements: "Extracting requirements from the job description",
  crawl_company_site: "Crawling the company website",
  search_interview_discussion: "Searching for public interview discussion",
  generate_company_brief: "Writing the company brief",
  generate_questions_technical: "Generating technical questions",
  generate_questions_behavioural: "Generating behavioural questions",
  "generate_questions_system-design": "Generating system design questions",
  "generate_questions_company-fit": "Generating company-fit questions",
  coverage_gap_fill: "Checking coverage and filling gaps",
  generate_flashcards: "Building flashcards",
  build_schedule: "Building your study schedule",
};

function iconFor(status: GenerationStep["status"]) {
  if (status === "done") return <span className="text-emerald-600">✓</span>;
  if (status === "failed") return <span className="text-red-600">✕</span>;
  if (status === "skipped") return <span className="text-gray-400">–</span>;
  return <span className="h-2 w-2 animate-pulse rounded-full bg-brand" />;
}

export function GenerationProgress({ steps, status }: { steps: GenerationStep[]; status: string }) {
  return (
    <div className="mx-auto max-w-lg" aria-live="polite">
      <div className="mb-4 flex items-center gap-2">
        <Spinner label={status === "failed" ? "Generation failed" : "Generating your prep kit…"} />
      </div>
      <ol className="space-y-2">
        {steps.length === 0 && <li className="text-sm text-gray-400">Starting up…</li>}
        {steps.map((step, i) => (
          <li key={`${step.name}-${i}`} className="flex items-start gap-3 rounded-lg border border-border bg-surface px-3 py-2 text-sm">
            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">{iconFor(step.status)}</span>
            <div>
              <p className="font-medium text-foreground">{STEP_LABELS[step.name] ?? step.name}</p>
              {step.detail && <p className="text-xs text-gray-500">{step.detail}</p>}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
