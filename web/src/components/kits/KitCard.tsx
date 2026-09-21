"use client";

import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { KitSummary } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "./StatusBadge";

export function KitCard({ kit }: { kit: KitSummary }) {
  const queryClient = useQueryClient();

  async function onDelete(e: React.MouseEvent) {
    e.preventDefault();
    if (!confirm(`Delete the kit for "${kit.role || kit.company}"? This cannot be undone.`)) return;
    await api.deleteKit(kit.id);
    queryClient.invalidateQueries({ queryKey: ["kits"] });
  }

  return (
    <Link href={`/kits/${kit.id}`} className="block">
      <Card className="p-4 transition-shadow hover:shadow-md">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate font-medium text-foreground">{kit.role || "Untitled role"}</h3>
            <p className="truncate text-sm text-gray-500">{kit.company || "Unknown company"}</p>
          </div>
          <StatusBadge status={kit.status} />
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
          <span>
            {kit.days} day{kit.days === 1 ? "" : "s"} to prep
            {kit.uncovered > 0 && <span className="ml-2 text-amber-600">{kit.uncovered} gap(s)</span>}
          </span>
          <button onClick={onDelete} className="text-gray-400 hover:text-red-600 cursor-pointer" aria-label="Delete kit">
            Delete
          </button>
        </div>
      </Card>
    </Link>
  );
}
