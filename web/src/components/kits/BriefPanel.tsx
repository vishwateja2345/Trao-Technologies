"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Kit } from "@/lib/types";
import { useDebouncedField } from "@/lib/useDebouncedField";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { TextArea } from "@/components/ui/Field";
import { OriginBadge } from "./OriginBadge";

export function BriefPanel({ kit }: { kit: Kit }) {
  const queryClient = useQueryClient();
  const [regenerating, setRegenerating] = useState(false);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["kit", kit.id] });

  const saveSummary = useMutation({
    mutationFn: (summary: string) => api.patchBrief(kit.id, { summary }),
    onSuccess: invalidate,
  });
  const saveWhatTheyDo = useMutation({
    mutationFn: (what_they_do: string) => api.patchBrief(kit.id, { what_they_do }),
    onSuccess: invalidate,
  });
  const togglePin = useMutation({
    mutationFn: (pinned: boolean) => api.patchBrief(kit.id, { pinned }),
    onSuccess: invalidate,
  });

  const summaryField = useDebouncedField(kit.company_brief.summary, (v) => saveSummary.mutate(v));
  const whatField = useDebouncedField(kit.company_brief.what_they_do, (v) => saveWhatTheyDo.mutate(v));

  async function onRegenerate() {
    setRegenerating(true);
    try {
      await api.regenerate(kit.id, "brief");
      invalidate();
    } catch {
      if (
        confirm(
          "This brief has been edited or pinned, so it won't be overwritten automatically. Regenerate anyway and discard your edits?"
        )
      ) {
        await api.regenerate(kit.id, "brief", { force: true });
        invalidate();
      }
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold text-foreground">Company brief</h3>
          <p className="text-sm text-gray-500">{kit.source.company || "Unknown company"}</p>
        </div>
        <div className="flex items-center gap-2">
          <OriginBadge origin={kit.company_brief.origin ?? "generated"} pinned={kit.company_brief.pinned} />
          <Button size="sm" variant="secondary" onClick={() => togglePin.mutate(!kit.company_brief.pinned)}>
            {kit.company_brief.pinned ? "Unpin" : "Pin"}
          </Button>
          <Button size="sm" variant="secondary" loading={regenerating} onClick={onRegenerate}>
            Regenerate
          </Button>
        </div>
      </div>

      <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-400" htmlFor="brief-summary">
        Summary
      </label>
      <TextArea
        id="brief-summary"
        rows={3}
        value={summaryField.value}
        onChange={(e) => summaryField.handleChange(e.target.value)}
        onBlur={summaryField.flush}
      />

      <label className="mb-1 mt-4 block text-xs font-medium uppercase tracking-wide text-gray-400" htmlFor="brief-what">
        What they do
      </label>
      <TextArea
        id="brief-what"
        rows={2}
        value={whatField.value}
        onChange={(e) => whatField.handleChange(e.target.value)}
        onBlur={whatField.flush}
      />

      {kit.company_brief.sources.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Sources</p>
          <ul className="mt-1 space-y-1">
            {kit.company_brief.sources.map((src) => (
              <li key={src} className="truncate text-xs text-brand">
                <a href={src} target="_blank" rel="noreferrer" className="hover:underline">
                  {src}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      {kit.company_brief.sources.length === 0 && (
        <p className="mt-4 text-xs text-amber-700">No pages could be retrieved from the company site for this brief.</p>
      )}
    </Card>
  );
}
