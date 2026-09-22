"use client";

import { useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { api, getErrorMessage } from "@/lib/api";
import type { KitSummary } from "@/lib/types";
import { StatusBadge } from "./StatusBadge";

/**
 * A single departure-board row: STATUS · ROLE @ COMPANY · DAYS · actions —
 * read left to right like a real timetable line, not a same-size
 * icon+heading+text card. Rows stack in a bordered list (KitBoard) with
 * a shared rule between them, evoking one continuous board rather than a
 * scattered grid of cards.
 */
export function KitCard({ kit }: { kit: KitSummary }) {
  const queryClient = useQueryClient();
  const [deleting, setDeleting] = useState(false);

  async function onDelete(e: React.MouseEvent) {
    e.preventDefault();
    if (!confirm(`Delete the kit for "${kit.role || kit.company}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await api.deleteKit(kit.id);
      queryClient.invalidateQueries({ queryKey: ["kits"] });
    } catch (err) {
      alert(getErrorMessage(err, "Could not delete this kit. Please try again."));
      setDeleting(false);
    }
  }

  return (
    <li>
      <Link
        href={`/kits/${kit.id}`}
        className="flex flex-col gap-2 px-4 py-3 transition-colors hover:bg-panel-recessed sm:flex-row sm:items-center sm:gap-4"
      >
        <div className="w-28 shrink-0">
          <StatusBadge status={kit.status} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-ink">{kit.role || "Untitled role"}</p>
          <p className="truncate text-sm text-ink-muted">{kit.company || "Unknown company"}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3 font-mono text-xs text-ink-muted">
          <span>
            {String(kit.days).padStart(2, "0")} DAY{kit.days === 1 ? "" : "S"}
          </span>
          {kit.uncovered > 0 && <span className="text-amber-strong">{kit.uncovered} GAP{kit.uncovered === 1 ? "" : "S"}</span>}
          <button
            onClick={onDelete}
            disabled={deleting}
            className="text-ink-faint hover:text-signal-danger cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Delete kit"
          >
            {deleting ? "DELETING…" : "DELETE"}
          </button>
        </div>
      </Link>
    </li>
  );
}
