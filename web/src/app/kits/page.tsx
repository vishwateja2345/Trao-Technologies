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
    <div className="space-y-8">
      <section>
        <h1 className="text-lg font-semibold text-foreground">Create a prep kit</h1>
        <p className="mt-1 text-sm text-gray-500">
          Paste a job description and a company website, or prepare for several roles at once.
        </p>
        <Card className="mt-4 p-5">
          <div className="mb-4 flex gap-1 rounded-lg bg-gray-100 p-1 text-sm" role="tablist" aria-label="Kit creation mode">
            <button
              role="tab"
              aria-selected={tab === "single"}
              onClick={() => setTab("single")}
              className={`flex-1 rounded-md py-1.5 font-medium cursor-pointer ${tab === "single" ? "bg-white shadow-sm text-foreground" : "text-gray-500"}`}
            >
              Single role
            </button>
            <button
              role="tab"
              aria-selected={tab === "batch"}
              onClick={() => setTab("batch")}
              className={`flex-1 rounded-md py-1.5 font-medium cursor-pointer ${tab === "batch" ? "bg-white shadow-sm text-foreground" : "text-gray-500"}`}
            >
              Upload multiple (file)
            </button>
          </div>
          {tab === "single" ? <NewKitForm /> : <BatchUploadForm />}
        </Card>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-foreground">Your kits</h2>
        <div className="mt-4">
          {isLoading && <Spinner label="Loading your kits…" />}
          {isError && <ErrorBanner message="Could not load your kits." onRetry={() => refetch()} />}
          {!isLoading && !isError && data?.kits.length === 0 && (
            <EmptyState title="No kits yet" description="Create your first prep kit above to get started." />
          )}
          {!isLoading && data && data.kits.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {data.kits.map((kit) => (
                <KitCard key={kit.id} kit={kit} />
              ))}
            </div>
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
