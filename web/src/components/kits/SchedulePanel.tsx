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
          <h3 className="font-semibold text-foreground">Study schedule</h3>
          <p className="text-sm text-gray-500">{kit.schedule.days_available} day(s) requested</p>
        </div>
        <div className="flex items-end gap-2">
          <OriginBadge origin={kit.schedule.origin ?? "generated"} pinned={kit.schedule.pinned} />
          <label className="text-xs text-gray-500">
            Days
            <TextInput
              type="number"
              min={1}
              max={120}
              className="mt-1 w-20"
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
          <li key={day.day} className="rounded-lg border border-border p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-medium text-foreground">
                Day {day.day} · {day.focus}
              </span>
              <Badge tone="neutral">{day.minutes} min</Badge>
            </div>
            <ul className="space-y-1 text-sm text-gray-600">
              {day.question_ids.map((qid) => {
                const q = questionById.get(qid);
                return <li key={qid}>{q ? q.prompt : `(question ${qid})`}</li>;
              })}
            </ul>
          </li>
        ))}
      </ol>
    </Card>
  );
}
