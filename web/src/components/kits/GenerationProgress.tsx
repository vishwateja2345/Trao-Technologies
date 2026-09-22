import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
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

const STATUS_BADGE: Record<GenerationStep["status"], { label: string; tone: "success" | "danger" | "neutral" | "brand" }> = {
  done: { label: "Done", tone: "success" },
  failed: { label: "Fail", tone: "danger" },
  skipped: { label: "Skip", tone: "neutral" },
  pending: { label: "Wait", tone: "neutral" },
  running: { label: "Live", tone: "brand" },
};

/**
 * The generation manifest, read like a pre-flight checklist: each pipeline
 * step is a row with a status plate, not a generic checklist of ticks —
 * this is the moment the board's "in progress" energy matters most.
 */
export function GenerationProgress({ steps, status }: { steps: GenerationStep[]; status: string }) {
  return (
    <div className="mx-auto max-w-lg" aria-live="polite">
      <div className="mb-4 flex items-center gap-2">
        <span className="flex gap-0.5" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-3 w-2 rounded-[1px] border border-amber-strong bg-amber-tint"
              style={{ animation: "flap-flip 0.9s cubic-bezier(0.16,1,0.3,1) infinite", animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </span>
        <span className="font-mono text-xs uppercase tracking-wider text-ink-muted">
          {status === "failed" ? "Generation failed" : "Building your prep kit"}
        </span>
      </div>
      <Card className="divide-y divide-rule overflow-hidden">
        {steps.length === 0 && <p className="px-4 py-3 font-mono text-xs uppercase tracking-wide text-ink-faint">Starting up…</p>}
        {steps.map((step, i) => {
          const badge = STATUS_BADGE[step.status];
          return (
            <div key={`${step.name}-${i}`} className="flex items-start justify-between gap-3 px-4 py-2.5">
              <div>
                <p className="text-sm text-ink">{STEP_LABELS[step.name] ?? step.name}</p>
                {step.detail && <p className="mt-0.5 text-xs text-ink-muted">{step.detail}</p>}
              </div>
              <Badge tone={badge.tone} className="shrink-0">
                {badge.label}
              </Badge>
            </div>
          );
        })}
      </Card>
    </div>
  );
}
