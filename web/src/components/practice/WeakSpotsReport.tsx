"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import type { WeakSpotEntry } from "@/lib/types";

const STATUS_CONFIG: Record<WeakSpotEntry["status"], { label: string; tone: "danger" | "warning" | "neutral" | "success" }> = {
  gap: { label: "No question yet", tone: "danger" },
  weak: { label: "Low confidence", tone: "warning" },
  unpracticed: { label: "Not practised yet", tone: "neutral" },
  solid: { label: "Solid", tone: "success" },
};

export function WeakSpotsReport({ kitId, company, role }: { kitId: string; company: string; role: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["weak-spots", kitId],
    queryFn: () => api.weakSpots(kitId),
  });

  if (isLoading) return <Spinner label="Building your weak-spots report…" />;
  if (isError || !data) return <p className="text-sm text-signal-danger">Could not load the weak-spots report.</p>;

  const report = data.report;
  const priority = report.filter((r) => r.status === "gap" || r.status === "weak");
  const rest = report.filter((r) => r.status === "unpracticed" || r.status === "solid");

  return (
    <div>
      <div className="mb-4 flex items-center justify-between no-print">
        <div>
          <h2 className="text-lg font-semibold text-ink">Weak spots report</h2>
          <p className="text-sm text-ink-muted">Combines coverage gaps with your practice confidence — one ranked focus list.</p>
        </div>
        <Button variant="secondary" onClick={() => window.print()} disabled={report.length === 0}>
          Print / save as PDF
        </Button>
      </div>

      <div className="mb-4 hidden print:block">
        <h1 className="text-xl font-semibold">
          Interview prep — weak spots: {role} @ {company}
        </h1>
        <p className="text-sm text-ink-muted">Generated {new Date().toLocaleDateString()}</p>
      </div>

      {report.length === 0 ? (
        <Card className="p-4 text-sm text-ink-muted">
          This kit doesn&apos;t have any requirements to track yet — the job description may have been too short to extract
          anything from. Add requirements-linked questions or flashcards in the builder, or try regenerating with a fuller job
          description.
        </Card>
      ) : priority.length === 0 ? (
        <Card className="p-4 text-sm text-signal-ok">
          No gaps or low-confidence requirements right now — nice work. Keep practising to build a review history.
        </Card>
      ) : (
        <Card className="p-4">
          <p className="mb-3 font-mono text-xs uppercase tracking-wider text-ink-faint">Focus on these {priority.length} first</p>
          <ol className="divide-y divide-rule">
            {priority.map((entry, i) => (
              <li key={entry.requirement_id} className="flex items-start justify-between gap-3 py-2.5 text-sm">
                <span className="flex items-baseline gap-2">
                  <span className="font-mono text-xs text-ink-faint">{String(i + 1).padStart(2, "0")}</span>
                  <span className="text-ink">{entry.text}</span>
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  <Badge tone={entry.priority === "must" ? "brand" : "neutral"}>{entry.priority}</Badge>
                  <Badge tone={STATUS_CONFIG[entry.status].tone}>{STATUS_CONFIG[entry.status].label}</Badge>
                </span>
              </li>
            ))}
          </ol>
        </Card>
      )}

      {rest.length > 0 && (
        <Card className="mt-4 p-4">
          <p className="mb-3 font-mono text-xs uppercase tracking-wider text-ink-faint">Everything else</p>
          <ul className="divide-y divide-rule">
            {rest.map((entry) => (
              <li key={entry.requirement_id} className="flex items-start justify-between gap-3 py-2.5 text-sm">
                <span className="text-ink">{entry.text}</span>
                <span className="flex shrink-0 items-center gap-1">
                  <Badge tone={entry.priority === "must" ? "brand" : "neutral"}>{entry.priority}</Badge>
                  <Badge tone={STATUS_CONFIG[entry.status].tone}>{STATUS_CONFIG[entry.status].label}</Badge>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
