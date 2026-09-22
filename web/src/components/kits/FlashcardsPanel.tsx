"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, getErrorMessage } from "@/lib/api";
import type { Flashcard, Kit } from "@/lib/types";
import { useDebouncedField } from "@/lib/useDebouncedField";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { TextArea } from "@/components/ui/Field";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { OriginBadge } from "./OriginBadge";

function FlashcardEditor({ kitId, card, onChanged }: { kitId: string; card: Flashcard; onChanged: () => void }) {
  const editMutation = useMutation({
    mutationFn: (patch: Record<string, unknown>) => api.editFlashcard(kitId, card.id, patch),
    onSuccess: onChanged,
  });
  const deleteMutation = useMutation({
    mutationFn: () => api.deleteFlashcard(kitId, card.id),
    onSuccess: onChanged,
  });

  const frontField = useDebouncedField(card.front, (v) => editMutation.mutate({ front: v }));
  const backField = useDebouncedField(card.back, (v) => editMutation.mutate({ back: v }));

  return (
    <li className="rounded-md border border-rule bg-panel p-3">
      <div className="mb-2 flex items-center justify-between">
        <OriginBadge origin={card.origin} pinned={card.pinned} />
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => editMutation.mutate({ pinned: !card.pinned })}>
            {card.pinned ? "Unpin" : "Pin"}
          </Button>
          <Button size="sm" variant="danger" onClick={() => deleteMutation.mutate()} loading={deleteMutation.isPending}>
            Delete
          </Button>
        </div>
      </div>
      <label className="font-mono text-[0.6875rem] uppercase tracking-wider text-ink-faint" htmlFor={`flashcard-front-${card.id}`}>
        Front
      </label>
      <TextArea
        id={`flashcard-front-${card.id}`}
        rows={2}
        value={frontField.value}
        onChange={(e) => frontField.handleChange(e.target.value)}
        onBlur={frontField.flush}
      />
      <label className="mt-2 block font-mono text-[0.6875rem] uppercase tracking-wider text-ink-faint" htmlFor={`flashcard-back-${card.id}`}>
        Back
      </label>
      <TextArea
        id={`flashcard-back-${card.id}`}
        rows={2}
        value={backField.value}
        onChange={(e) => backField.handleChange(e.target.value)}
        onBlur={backField.flush}
      />
    </li>
  );
}

function AddFlashcardForm({ kitId, onDone }: { kitId: string; onDone: () => void }) {
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!front.trim() || !back.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.addFlashcard(kitId, { front: front.trim(), back: back.trim() });
      setFront("");
      setBack("");
      onDone();
    } catch (err) {
      setError(getErrorMessage(err, "Could not add that flashcard. Please try again."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mb-4 space-y-2 rounded-md border border-dashed border-rule-strong p-3">
      {error && <ErrorBanner message={error} />}
      <TextArea
        rows={2}
        placeholder="Front (question/prompt)…"
        aria-label="New flashcard front"
        value={front}
        onChange={(e) => setFront(e.target.value)}
        autoFocus
      />
      <TextArea rows={2} placeholder="Back (answer)…" aria-label="New flashcard back" value={back} onChange={(e) => setBack(e.target.value)} />
      <Button type="submit" size="sm" loading={submitting} disabled={!front.trim() || !back.trim()}>
        Add flashcard
      </Button>
    </form>
  );
}

export function FlashcardsPanel({ kit }: { kit: Kit }) {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["kit", kit.id] });

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold text-ink">Flashcards ({kit.flashcards.length})</h3>
        <Button size="sm" variant="secondary" onClick={() => setAdding((v) => !v)}>
          + Add flashcard
        </Button>
      </div>
      {adding && (
        <AddFlashcardForm
          kitId={kit.id}
          onDone={() => {
            setAdding(false);
            invalidate();
          }}
        />
      )}
      {kit.flashcards.length === 0 ? (
        <p className="rounded-md border border-dashed border-rule-strong px-3 py-6 text-center text-sm text-ink-faint">No flashcards yet.</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {kit.flashcards.map((card) => (
            <FlashcardEditor key={card.id} kitId={kit.id} card={card} onChanged={invalidate} />
          ))}
        </ul>
      )}
    </Card>
  );
}
