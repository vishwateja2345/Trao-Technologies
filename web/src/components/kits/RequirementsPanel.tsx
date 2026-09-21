import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import type { Kit } from "@/lib/types";

export function RequirementsPanel({ kit }: { kit: Kit }) {
  const uncovered = new Set(kit.coverage.uncovered_requirement_ids);

  return (
    <Card className="p-5">
      <h3 className="font-semibold text-foreground">
        {kit.role.title || "Role"} <span className="font-normal text-gray-400">· {kit.role.seniority || "unspecified seniority"}</span>
      </h3>

      {kit.role.responsibilities.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Responsibilities</p>
          <ul className="mt-1 list-inside list-disc space-y-1 text-sm text-foreground">
            {kit.role.responsibilities.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Requirements</p>
        {kit.role.requirements.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">
            Almost nothing could be extracted from this job description — it may be too short or vague. Try adding more detail.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {kit.role.requirements.map((req) => (
              <li key={req.id} className="flex items-start justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm">
                <span className="text-foreground">{req.text}</span>
                <span className="flex shrink-0 items-center gap-1">
                  <Badge tone={req.priority === "must" ? "brand" : "neutral"}>{req.priority}</Badge>
                  <Badge tone="neutral">{req.kind}</Badge>
                  {uncovered.has(req.id) && <Badge tone="danger">No question yet</Badge>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
