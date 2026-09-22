import { Badge } from "@/components/ui/Badge";
import type { ItemOrigin } from "@/lib/types";

export function OriginBadge({ origin, pinned }: { origin: ItemOrigin; pinned?: boolean }) {
  return (
    <div className="flex items-center gap-1">
      {origin === "edited" && <Badge tone="brand">Edited</Badge>}
      {origin === "user_added" && <Badge tone="brand">Yours</Badge>}
      {pinned && <Badge tone="warning">Pinned</Badge>}
    </div>
  );
}
