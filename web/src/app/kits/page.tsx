"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { RequireAuth } from "@/components/RequireAuth";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Spinner } from "@/components/ui/Spinner";
import { NewKitForm } from "@/components/kits/NewKitForm";
import { BatchUploadForm } from "@/components/kits/BatchUploadForm";
import { KitCard } from "@/components/kits/KitCard";

type Tab = "single" | "batch";

function KitsDashboard() {
  const [tab, setTab] = useState<Tab>("single");
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["kits"],
    queryFn: api.listKits,
    refetchInterval: (query) => {
      const kits = query.state.data?.kits ?? [];
      const anyActive = kits.some((k) => k.status === "pending" || k.status === "researching" || k.status === "generating");
      return anyActive ? 3000 : false;
    },
  });

  return (
    <div className="space-y-10">
      <section>
        <h1 className="text-xl font-semibold tracking-tight text-ink">Create a prep kit</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Paste a job description and a company website, or prepare for several roles at once.
        </p>
        <Card className="mt-4 overflow-hidden">
          <div className="flex border-b border-rule" role="tablist" aria-label="Kit creation mode">
            <button
              role="tab"
              aria-selected={tab === "single"}
              onClick={() => setTab("single")}
              className={`flex-1 border-b-2 py-2.5 font-mono text-xs uppercase tracking-wider cursor-pointer ${
                tab === "single" ? "border-amber text-amber-strong" : "border-transparent text-ink-muted hover:text-ink"
              }`}
            >
              Single role
            </button>
            <button
              role="tab"
              aria-selected={tab === "batch"}
              onClick={() => setTab("batch")}
              className={`flex-1 border-b-2 py-2.5 font-mono text-xs uppercase tracking-wider cursor-pointer ${
                tab === "batch" ? "border-amber text-amber-strong" : "border-transparent text-ink-muted hover:text-ink"
              }`}
            >
              Upload multiple
            </button>
          </div>
          <div className="p-5">{tab === "single" ? <NewKitForm /> : <BatchUploadForm />}</div>
        </Card>
      </section>

      <section>
        <h2 className="text-xl font-semibold tracking-tight text-ink">Your kits</h2>
        <div className="mt-4">
          {isLoading && <Spinner label="Loading your kits…" />}
          {isError && <ErrorBanner message="Could not load your kits." onRetry={() => refetch()} />}
          {!isLoading && !isError && data?.kits.length === 0 && (
            <EmptyState title="No kits yet" description="Create your first prep kit above to get started." />
          )}
          {!isLoading && data && data.kits.length > 0 && (
            <Card className="overflow-hidden">
              <ul className="divide-y divide-rule">
                {data.kits.map((kit) => (
                  <KitCard key={kit.id} kit={kit} />
                ))}
              </ul>
            </Card>
          )}
        </div>
      </section>
    </div>
  );
}

export default function KitsPage() {
  return (
    <RequireAuth>
      <KitsDashboard />
    </RequireAuth>
  );
}
