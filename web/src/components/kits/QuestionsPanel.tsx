"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, sortableKeyboardCoordinates, arrayMove } from "@dnd-kit/sortable";
import { api } from "@/lib/api";
import type { Kit, Question, QuestionCategory } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { QuestionCard } from "./QuestionCard";
import { AddQuestionForm } from "./AddQuestionForm";

const CATEGORIES: { key: QuestionCategory; label: string }[] = [
  { key: "technical", label: "Technical" },
  { key: "behavioural", label: "Behavioural" },
  { key: "system-design", label: "System Design" },
  { key: "company-fit", label: "Company Fit" },
];

export function QuestionsPanel({ kit }: { kit: Kit }) {
  const queryClient = useQueryClient();
  const [addingTo, setAddingTo] = useState<QuestionCategory | null>(null);
  const [regeneratingCategory, setRegeneratingCategory] = useState<QuestionCategory | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["kit", kit.id] });

  const reorderMutation = useMutation({
    mutationFn: ({ category, orderedIds }: { category: QuestionCategory; orderedIds: string[] }) =>
      api.reorderQuestions(kit.id, category, orderedIds),
  });

  function questionsFor(category: QuestionCategory): Question[] {
    return kit.questions.filter((q) => q.category === category);
  }

  function onDragEnd(category: QuestionCategory) {
    return (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const items = questionsFor(category);
      const oldIndex = items.findIndex((q) => q.id === active.id);
      const newIndex = items.findIndex((q) => q.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;
      const reordered = arrayMove(items, oldIndex, newIndex);
      const orderedIds = reordered.map((q) => q.id);

      // Optimistic update so the drag feels instant, not round-tripped.
      queryClient.setQueryData(["kit", kit.id], (old: { kit: Kit } | undefined) => {
        if (!old) return old;
        const others = old.kit.questions.filter((q) => q.category !== category);
        return { kit: { ...old.kit, questions: [...others, ...reordered] } };
      });
      reorderMutation.mutate({ category, orderedIds }, { onSettled: invalidate });
    };
  }

  async function onRegenerateCategory(category: QuestionCategory) {
    setRegeneratingCategory(category);
    try {
      await api.regenerate(kit.id, `questions:${category}`);
      invalidate();
    } finally {
      setRegeneratingCategory(null);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {CATEGORIES.map(({ key, label }) => {
        const items = questionsFor(key);
        const editableCount = items.filter((q) => q.origin !== "generated" || q.pinned).length;
        return (
          <Card key={key} className="p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-foreground">{label}</h3>
                <Badge tone="neutral">{items.length}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={() => setAddingTo(addingTo === key ? null : key)}>
                  + Add
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  loading={regeneratingCategory === key}
                  onClick={() => onRegenerateCategory(key)}
                  title={editableCount > 0 ? `${editableCount} edited/pinned question(s) will be kept` : undefined}
                >
                  Regenerate
                </Button>
              </div>
            </div>

            {addingTo === key && (
              <AddQuestionForm
                kitId={kit.id}
                category={key}
                requirements={kit.role.requirements}
                onDone={() => {
                  setAddingTo(null);
                  invalidate();
                }}
              />
            )}

            {items.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-gray-400">
                No {label.toLowerCase()} questions yet.
              </p>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd(key)}>
                <SortableContext items={items.map((q) => q.id)} strategy={verticalListSortingStrategy}>
                  <ul className="space-y-2">
                    {items.map((q) => (
                      <QuestionCard key={q.id} kitId={kit.id} question={q} requirements={kit.role.requirements} onChanged={invalidate} />
                    ))}
                  </ul>
                </SortableContext>
              </DndContext>
            )}
          </Card>
        );
      })}
    </div>
  );
}
