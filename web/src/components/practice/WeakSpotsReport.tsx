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
  if (isError || !data) return <p className="text-sm text-red-600">Could not load the weak-spots report.</p>;

  const report = data.report;
  const priority = report.filter((r) => r.status === "gap" || r.status === "weak");

  return (
    <div className="printable-report">
      <style jsx global>{`
        @media print {
          nav,
          header,
          .no-print {
            display: none !important;
          }
          body {
            background: white !important;
          }
        }
      `}</style>

      <div className="mb-4 flex items-center justify-between no-print">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Weak spots report</h2>
          <p className="text-sm text-gray-500">Combines coverage gaps with your practice confidence — one ranked focus list.</p>
        </div>
        <Button variant="secondary" onClick={() => window.print()}>
          Print / save as PDF
        </Button>
      </div>

      <div className="mb-4 hidden print:block">
        <h1 className="text-xl font-semibold">
          Interview prep — weak spots: {role} @ {company}
        </h1>
        <p className="text-sm text-gray-500">Generated {new Date().toLocaleDateString()}</p>
      </div>

      {priority.length === 0 ? (
        <Card className="p-4 text-sm text-emerald-700">
          No gaps or low-confidence requirements right now — nice work. Keep practising to build a review history.
        </Card>
      ) : (
        <Card className="p-4">
          <p className="mb-3 text-sm font-medium text-foreground">Focus on these {priority.length} first:</p>
          <ol className="space-y-2">
            {priority.map((entry, i) => (
              <li key={entry.requirement_id} className="flex items-start justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm">
                <span>
                  <span className="mr-2 text-gray-400">{i + 1}.</span>
                  {entry.text}
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

      <Card className="mt-4 p-4">
        <p className="mb-3 text-sm font-medium text-foreground">Everything else</p>
        <ul className="space-y-2 text-sm">
          {report
            .filter((r) => r.status === "unpracticed" || r.status === "solid")
            .map((entry) => (
              <li key={entry.requirement_id} className="flex items-start justify-between gap-3 rounded-lg border border-border px-3 py-2">
                <span>{entry.text}</span>
                <span className="flex shrink-0 items-center gap-1">
                  <Badge tone={entry.priority === "must" ? "brand" : "neutral"}>{entry.priority}</Badge>
                  <Badge tone={STATUS_CONFIG[entry.status].tone}>{STATUS_CONFIG[entry.status].label}</Badge>
                </span>
              </li>
            ))}
        </ul>
      </Card>
    </div>
  );
}
