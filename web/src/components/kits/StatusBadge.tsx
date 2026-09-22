import { Badge } from "@/components/ui/Badge";
import type { GenerationStatus } from "@/lib/types";

const STATUS_CONFIG: Record<
  GenerationStatus,
  { label: string; tone: "neutral" | "brand" | "success" | "warning" | "danger"; live?: boolean }
> = {
  pending: { label: "Queued", tone: "neutral" },
  researching: { label: "Researching", tone: "brand", live: true },
  generating: { label: "Building", tone: "brand", live: true },
  ready: { label: "Ready", tone: "success" },
  partial: { label: "Partial", tone: "warning" },
  failed: { label: "Failed", tone: "danger" },
};

export function StatusBadge({ status }: { status: GenerationStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <Badge tone={config.tone} className="gap-1">
      {config.live && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" aria-hidden="true" />}
      {config.label}
    </Badge>
  );
}
