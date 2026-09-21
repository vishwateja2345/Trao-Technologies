"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { RequireAuth } from "@/components/RequireAuth";
import { Spinner } from "@/components/ui/Spinner";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/kits/StatusBadge";
import { GenerationProgress } from "@/components/kits/GenerationProgress";
import { BriefPanel } from "@/components/kits/BriefPanel";
import { RequirementsPanel } from "@/components/kits/RequirementsPanel";
import { QuestionsPanel } from "@/components/kits/QuestionsPanel";
import { FlashcardsPanel } from "@/components/kits/FlashcardsPanel";
import { SchedulePanel } from "@/components/kits/SchedulePanel";

type Tab = "brief" | "role" | "questions" | "flashcards" | "schedule";

const TABS: { key: Tab; label: string }[] = [
  { key: "brief", label: "Company brief" },
  { key: "role", label: "Role & requirements" },
  { key: "questions", label: "Questions" },
  { key: "flashcards", label: "Flashcards" },
  { key: "schedule", label: "Schedule" },
];

function KitDetail({ id }: { id: string }) {
  const [tab, setTab] = useState<Tab>("brief");

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["kit", id],
    queryFn: () => api.getKit(id),
    refetchInterval: (query) => {
      const status = query.state.data?.kit.status;
      return status === "pending" || status === "researching" || status === "generating" ? 2000 : false;
    },
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner label="Loading kit…" />
      </div>
    );
  }

  if (isError || !data) {
    const message = error instanceof Error ? error.message : "Could not load this kit.";
    return <ErrorBanner message={message} onRetry={() => refetch()} />;
  }

  const kit = data.kit;
  const isGenerating = kit.status === "pending" || kit.status === "researching" || kit.status === "generating";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/kits" className="text-sm text-gray-400 hover:text-foreground">
            ← Back to your kits
          </Link>
          <h1 className="mt-1 text-xl font-semibold text-foreground">
            {kit.source.role || "Untitled role"} <span className="text-gray-400">at</span> {kit.source.company || "Unknown company"}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={kit.status} />
          {!isGenerating && (
            <Link href={`/kits/${id}/practice`}>
              <Button variant="secondary">Practice mode</Button>
            </Link>
          )}
        </div>
      </div>

      {isGenerating && <GenerationProgress steps={kit.generationSteps} status={kit.status} />}

      {kit.status === "failed" && (
        <ErrorBanner message={kit.failureReason || "Generation failed. The job description or company URL may need adjusting."} />
      )}

      {!isGenerating && kit.status !== "failed" && (
        <>
          {kit.failureReason && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800" role="status">
              Some steps had gaps: {kit.failureReason}
            </div>
          )}
          {kit.coverage.uncovered_requirement_ids.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800" role="status">
              {kit.coverage.uncovered_requirement_ids.length} must-have requirement(s) still have no question after{" "}
              {kit.coverage.passes} pass(es). See the Role tab for details.
            </div>
          )}

          <div className="border-b border-border">
            <nav className="-mb-px flex flex-wrap gap-1" role="tablist" aria-label="Kit sections">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  role="tab"
                  aria-selected={tab === t.key}
                  onClick={() => setTab(t.key)}
                  className={`rounded-t-lg px-3 py-2 text-sm font-medium cursor-pointer ${
                    tab === t.key ? "border-b-2 border-brand text-brand" : "text-gray-500 hover:text-foreground"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </nav>
          </div>

          <div>
            {tab === "brief" && <BriefPanel kit={kit} />}
            {tab === "role" && <RequirementsPanel kit={kit} />}
            {tab === "questions" && <QuestionsPanel kit={kit} />}
            {tab === "flashcards" && <FlashcardsPanel kit={kit} />}
            {tab === "schedule" && <SchedulePanel kit={kit} />}
          </div>
        </>
      )}
    </div>
  );
}

export default function KitDetailPage() {
  const params = useParams<{ id: string }>();
  return (
    <RequireAuth>
      <KitDetail id={params.id} />
    </RequireAuth>
  );
}
