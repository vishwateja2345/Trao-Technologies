"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api, getErrorMessage } from "@/lib/api";
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
  { key: "brief", label: "Brief" },
  { key: "role", label: "Requirements" },
  { key: "questions", label: "Questions" },
  { key: "flashcards", label: "Flashcards" },
  { key: "schedule", label: "Schedule" },
];

function KitDetail({ id }: { id: string }) {
  const [tab, setTab] = useState<Tab>("brief");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const router = useRouter();

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
          <Link href="/kits" className="font-mono text-xs uppercase tracking-wider text-ink-faint hover:text-ink">
            ← Back to your kits
          </Link>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-ink">
            {kit.source.role || "Untitled role"} <span className="font-normal text-ink-faint">at</span>{" "}
            {kit.source.company || "Unknown company"}
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
        <div className="space-y-3">
          <ErrorBanner message={kit.failureReason || "Generation failed. The job description or company URL may need adjusting."} />
          {deleteError && <ErrorBanner message={deleteError} />}
          <p className="text-sm text-ink-muted">
            This kit could not be generated. Delete it and create a new one — check that the company URL is reachable and the job
            description has some real content.
          </p>
          <Button
            variant="danger"
            loading={deleting}
            onClick={async () => {
              setDeleting(true);
              setDeleteError(null);
              try {
                await api.deleteKit(id);
                router.push("/kits");
              } catch (err) {
                setDeleteError(getErrorMessage(err, "Could not delete this kit. Please try again."));
                setDeleting(false);
              }
            }}
          >
            Delete this kit
          </Button>
        </div>
      )}

      {!isGenerating && kit.status !== "failed" && (
        <>
          {kit.warnings.length > 0 && (
            <div className="rounded-md border border-amber-strong bg-amber-tint px-4 py-3 text-sm text-amber-strong" role="status">
              <p className="font-mono text-xs uppercase tracking-wider">Worth knowing about this kit</p>
              <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-ink">
                {kit.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}
          {kit.coverage.uncovered_requirement_ids.length > 0 && (
            <div className="rounded-md border border-amber-strong bg-amber-tint px-4 py-3 text-sm text-ink" role="status">
              {kit.coverage.uncovered_requirement_ids.length} must-have requirement(s) still have no question after{" "}
              {kit.coverage.passes} pass(es). See the Requirements tab for details.
            </div>
          )}

          <div className="border-b border-rule">
            <nav className="-mb-px flex flex-wrap gap-1" role="tablist" aria-label="Kit sections">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  role="tab"
                  aria-selected={tab === t.key}
                  onClick={() => setTab(t.key)}
                  className={`border-b-2 px-3 py-2 font-mono text-xs uppercase tracking-wider cursor-pointer ${
                    tab === t.key ? "border-amber text-amber-strong" : "border-transparent text-ink-muted hover:text-ink"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </nav>
          </div>

          <div key={tab} className="flap-flip">
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
