import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import type { Kit } from "@/lib/types";

export function RequirementsPanel({ kit }: { kit: Kit }) {
  const uncovered = new Set(kit.coverage.uncovered_requirement_ids);

  return (
    <Card className="p-5">
      <h3 className="font-semibold text-ink">
        {kit.role.title || "Role"} <span className="font-normal text-ink-muted">· {kit.role.seniority || "unspecified seniority"}</span>
      </h3>

      {kit.role.responsibilities.length > 0 && (
        <div className="mt-3">
          <p className="font-mono text-[0.6875rem] uppercase tracking-wider text-ink-faint">Responsibilities</p>
          <ul className="mt-1 list-inside list-disc space-y-1 text-sm text-ink">
            {kit.role.responsibilities.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4">
        <p className="font-mono text-[0.6875rem] uppercase tracking-wider text-ink-faint">Requirements</p>
        {kit.role.requirements.length === 0 ? (
          <p className="mt-2 text-sm text-ink-muted">
            Almost nothing could be extracted from this job description — it may be too short or vague. Try adding more detail.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-rule rounded-sm border border-rule">
            {kit.role.requirements.map((req) => (
              <li key={req.id} className="flex items-start justify-between gap-3 px-3 py-2.5 text-sm">
                <span className="flex min-w-0 items-baseline gap-2">
                  <span className="shrink-0 font-mono text-xs text-ink-faint">{req.id}</span>
                  <span className="text-ink">{req.text}</span>
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  <Badge tone={req.priority === "must" ? "brand" : "neutral"}>{req.priority}</Badge>
                  <Badge tone="neutral">{req.kind}</Badge>
                  {uncovered.has(req.id) && <Badge tone="danger">No question</Badge>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
