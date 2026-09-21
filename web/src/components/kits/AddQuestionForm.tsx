"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { QuestionCategory, Requirement } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { TextArea, Select } from "@/components/ui/Field";

export function AddQuestionForm({
  kitId,
  category,
  requirements,
  onDone,
}: {
  kitId: string;
  category: QuestionCategory;
  requirements: Requirement[];
  onDone: () => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [answerOutline, setAnswerOutline] = useState("");
  const [requirementId, setRequirementId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim()) return;
    setSubmitting(true);
    try {
      await api.addQuestion(kitId, {
        category,
        prompt: prompt.trim(),
        answer_outline: answerOutline.trim(),
        requirement_ids: requirementId ? [requirementId] : [],
      });
      onDone();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mb-3 space-y-2 rounded-lg border border-dashed border-border p-3">
      <TextArea rows={2} placeholder="Your question…" value={prompt} onChange={(e) => setPrompt(e.target.value)} autoFocus />
      <TextArea rows={2} placeholder="Answer outline (optional)…" value={answerOutline} onChange={(e) => setAnswerOutline(e.target.value)} />
      {requirements.length > 0 && (
        <Select value={requirementId} onChange={(e) => setRequirementId(e.target.value)}>
          <option value="">Not linked to a specific requirement</option>
          {requirements.map((r) => (
            <option key={r.id} value={r.id}>
              {r.text}
            </option>
          ))}
        </Select>
      )}
      <Button type="submit" size="sm" loading={submitting} disabled={!prompt.trim()}>
        Add question
      </Button>
    </form>
  );
}
