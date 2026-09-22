"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Kit } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { TextInput } from "@/components/ui/Field";
import { OriginBadge } from "./OriginBadge";

/**
 * The schedule rendered as a literal departure-board timetable: each day
 * is a row with a flap-seam divider between its header (day, focus,
 * duration — the "flight info" line) and its manifest of questions below.
 */
export function SchedulePanel({ kit }: { kit: Kit }) {
  const queryClient = useQueryClient();
  const [days, setDays] = useState(kit.schedule.days_available);
  const [regenerating, setRegenerating] = useState(false);
  const questionById = new Map(kit.questions.map((q) => [q.id, q]));

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["kit", kit.id] });

  async function onRegenerate() {
    setRegenerating(true);
    try {
      await api.regenerate(kit.id, "schedule", { days });
      invalidate();
    } catch {
      if (confirm("The schedule has been edited/pinned. Regenerate anyway and discard your edits?")) {
        await api.regenerate(kit.id, "schedule", { days, force: true });
        invalidate();
      }
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-ink">Study schedule</h3>
          <p className="font-mono text-xs text-ink-muted">
            {String(kit.schedule.days_available).padStart(2, "0")} DAY{kit.schedule.days_available === 1 ? "" : "S"} REQUESTED
          </p>
        </div>
        <div className="flex items-end gap-2">
          <OriginBadge origin={kit.schedule.origin ?? "generated"} pinned={kit.schedule.pinned} />
          <label className="font-mono text-[0.6875rem] uppercase tracking-wider text-ink-faint">
            Days
            <TextInput
              type="number"
              min={1}
              max={120}
              className="mt-1 w-20 font-mono"
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            />
          </label>
          <Button size="sm" variant="secondary" loading={regenerating} onClick={onRegenerate}>
            Regenerate
          </Button>
        </div>
      </div>

      <ol className="space-y-3">
        {kit.schedule.days.map((day) => (
          <li key={day.day} className="flap-seam rounded-md border border-rule bg-panel">
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="flex items-baseline gap-3">
                <span className="font-mono text-sm font-semibold text-amber-strong">DAY {String(day.day).padStart(2, "0")}</span>
                <span className="text-sm text-ink">{day.focus}</span>
              </span>
              <Badge tone="neutral">{day.minutes} min</Badge>
            </div>
            <ul className="space-y-1 px-4 py-2.5 text-sm text-ink-muted">
              {day.question_ids.map((qid) => {
                const q = questionById.get(qid);
                return (
                  <li key={qid} className="flex items-baseline gap-2">
                    <span className="font-mono text-xs text-ink-faint">{qid}</span>
                    <span>{q ? q.prompt : `(question ${qid})`}</span>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ol>
    </Card>
  );
}
