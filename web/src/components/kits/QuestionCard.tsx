"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Question, QuestionCategory, Requirement } from "@/lib/types";
import { useDebouncedField } from "@/lib/useDebouncedField";
import { TextArea, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { OriginBadge } from "./OriginBadge";

const CATEGORY_OPTIONS: QuestionCategory[] = ["technical", "behavioural", "system-design", "company-fit"];

export function QuestionCard({
  kitId,
  question,
  requirements,
  onChanged,
}: {
  kitId: string;
  question: Question;
  requirements: Requirement[];
  onChanged: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: question.id });

  const editMutation = useMutation({
    mutationFn: (patch: Record<string, unknown>) => api.editQuestion(kitId, question.id, patch),
    onSuccess: onChanged,
  });
  const deleteMutation = useMutation({
    mutationFn: () => api.deleteQuestion(kitId, question.id),
    onSuccess: onChanged,
  });

  const promptField = useDebouncedField(question.prompt, (v) => editMutation.mutate({ prompt: v }));
  const outlineField = useDebouncedField(question.answer_outline, (v) => editMutation.mutate({ answer_outline: v }));

  const linkedReqs = requirements.filter((r) => question.requirement_ids.includes(r.id));

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`rounded-lg border border-border bg-white p-3 ${isDragging ? "opacity-60 shadow-lg" : ""}`}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <button
          {...attributes}
          {...listeners}
          className="mt-1 cursor-grab text-gray-300 hover:text-gray-500 active:cursor-grabbing"
          aria-label="Drag to reorder"
          title="Drag to reorder"
        >
          ⠿
        </button>
        <div className="flex flex-1 flex-wrap items-center gap-1">
          <OriginBadge origin={question.origin} pinned={question.pinned} />
          <Badge tone="neutral">Difficulty {question.difficulty}</Badge>
          {linkedReqs.map((r) => (
            <Badge key={r.id} tone="brand" className="max-w-[10rem] truncate" title={r.text}>
              {r.text}
            </Badge>
          ))}
        </div>
      </div>

      <TextArea
        rows={2}
        value={promptField.value}
        onChange={(e) => promptField.handleChange(e.target.value)}
        onBlur={promptField.flush}
        aria-label="Question prompt"
      />
      <TextArea
        rows={2}
        className="mt-2"
        value={outlineField.value}
        onChange={(e) => outlineField.handleChange(e.target.value)}
        onBlur={outlineField.flush}
        placeholder="Answer outline…"
        aria-label="Answer outline"
      />

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <label className="text-gray-400">
            Difficulty
            <Select
              className="ml-1 inline-block w-auto py-1"
              value={question.difficulty}
              onChange={(e) => editMutation.mutate({ difficulty: Number(e.target.value) })}
            >
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
            </Select>
          </label>
          <label className="text-gray-400">
            Category
            <Select
              className="ml-1 inline-block w-auto py-1"
              value={question.category}
              onChange={(e) => editMutation.mutate({ category: e.target.value })}
            >
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </label>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => editMutation.mutate({ pinned: !question.pinned })}>
            {question.pinned ? "Unpin" : "Pin"}
          </Button>
          <Button size="sm" variant="danger" onClick={() => deleteMutation.mutate()} loading={deleteMutation.isPending}>
            Delete
          </Button>
        </div>
      </div>
    </li>
  );
}
