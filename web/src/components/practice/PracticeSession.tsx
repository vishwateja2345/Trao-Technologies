"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";

const CONFIDENCE_LABELS = ["Not at all", "Shaky", "Okay", "Confident", "Nailed it"];

export function PracticeSession({ kitId }: { kitId: string }) {
  const queryClient = useQueryClient();
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["practice-queue", kitId],
    queryFn: () => api.practiceQueue(kitId),
  });

  const recordMutation = useMutation({
    mutationFn: (vars: { flashcard_id: string; confidence: number }) => api.recordPractice(kitId, vars.flashcard_id, vars.confidence),
  });

  const queue = useMemo(() => data?.queue ?? [], [data]);
  // "Covered so far" is this session's progress, not lifetime history — see
  // git history for why times_reviewed alone is the wrong signal here.
  const coveredCount = Math.min(index, queue.length);

  if (isLoading) return <Spinner label="Loading your flashcards…" />;
  if (isError) return <p className="text-sm text-signal-danger">Could not load flashcards for practice.</p>;
  if (queue.length === 0) {
    return <EmptyState title="No flashcards yet" description="Generate or add flashcards in the builder before practising." />;
  }

  if (index >= queue.length) {
    return (
      <Card seam className="p-6 text-center">
        <h2 className="text-lg font-semibold text-ink">Session complete</h2>
        <p className="mt-1 text-sm text-ink-muted">
          You reviewed {queue.length} card{queue.length === 1 ? "" : "s"} this session.
        </p>
        <Button
          className="mt-4"
          onClick={() => {
            setIndex(0);
            setRevealed(false);
            queryClient.invalidateQueries({ queryKey: ["practice-queue", kitId] });
          }}
        >
          Start another round (least-confident first)
        </Button>
      </Card>
    );
  }

  const card = queue[index];

  function onConfidence(confidence: number) {
    recordMutation.mutate({ flashcard_id: card.flashcard_id, confidence });
    setRevealed(false);
    setIndex((i) => i + 1);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between font-mono text-xs uppercase tracking-wider text-ink-muted">
        <span>
          Card {String(index + 1).padStart(2, "0")} / {String(queue.length).padStart(2, "0")}
        </span>
        <span>
          {coveredCount}/{queue.length} covered
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-panel-recessed">
        <div className="h-full bg-amber transition-all" style={{ width: `${(index / queue.length) * 100}%` }} />
      </div>

      <Card seam className="flex min-h-64 flex-col items-center justify-center gap-4 p-8 text-center">
        {card.last_confidence !== null && (
          <Badge tone="neutral">Last time: {CONFIDENCE_LABELS[card.last_confidence - 1] ?? card.last_confidence}</Badge>
        )}
        <p className="text-lg font-medium text-ink">{card.front}</p>
        {revealed ? (
          <p key={card.flashcard_id} className="flap-flip rounded-md bg-panel-recessed p-4 text-sm text-ink">
            {card.back}
          </p>
        ) : (
          <Button variant="secondary" onClick={() => setRevealed(true)}>
            Reveal answer
          </Button>
        )}
      </Card>

      {revealed && (
        <div>
          <p className="mb-2 text-center font-mono text-xs uppercase tracking-wider text-ink-muted">How confident did you feel?</p>
          <div className="flex justify-center gap-2">
            {CONFIDENCE_LABELS.map((label, i) => (
              <Button key={label} variant="secondary" size="sm" onClick={() => onConfidence(i + 1)}>
                <span className="font-mono">{i + 1}</span>
                <span className="hidden sm:inline"> · {label}</span>
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
