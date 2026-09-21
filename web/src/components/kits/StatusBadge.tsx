import { Badge } from "@/components/ui/Badge";
import type { GenerationStatus } from "@/lib/types";

const STATUS_CONFIG: Record<GenerationStatus, { label: string; tone: "neutral" | "brand" | "success" | "warning" | "danger" }> = {
  pending: { label: "Queued", tone: "neutral" },
  researching: { label: "Researching…", tone: "brand" },
  generating: { label: "Generating…", tone: "brand" },
  ready: { label: "Ready", tone: "success" },
  partial: { label: "Ready (with gaps)", tone: "warning" },
  failed: { label: "Failed", tone: "danger" },
};

export function StatusBadge({ status }: { status: GenerationStatus }) {
  const config = STATUS_CONFIG[status];
  return <Badge tone={config.tone}>{config.label}</Badge>;
}
