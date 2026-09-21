"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { RequireAuth } from "@/components/RequireAuth";
import { PracticeSession } from "@/components/practice/PracticeSession";
import { WeakSpotsReport } from "@/components/practice/WeakSpotsReport";

type Tab = "practice" | "report";

function PracticePageBody({ kitId }: { kitId: string }) {
  const [tab, setTab] = useState<Tab>("practice");
  const { data } = useQuery({ queryKey: ["kit", kitId], queryFn: () => api.getKit(kitId) });

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <Link href={`/kits/${kitId}`} className="text-sm text-gray-400 hover:text-foreground no-print">
        ← Back to kit
      </Link>
      <div className="flex items-center justify-between no-print">
        <h1 className="text-xl font-semibold text-foreground">Practice</h1>
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1 text-sm">
          <button
            onClick={() => setTab("practice")}
            className={`rounded-md px-3 py-1 font-medium cursor-pointer ${tab === "practice" ? "bg-white shadow-sm text-foreground" : "text-gray-500"}`}
          >
            Flashcards
          </button>
          <button
            onClick={() => setTab("report")}
            className={`rounded-md px-3 py-1 font-medium cursor-pointer ${tab === "report" ? "bg-white shadow-sm text-foreground" : "text-gray-500"}`}
          >
            Weak spots
          </button>
        </div>
      </div>

      {tab === "practice" ? (
        <PracticeSession kitId={kitId} />
      ) : (
        <WeakSpotsReport kitId={kitId} company={data?.kit.source.company ?? ""} role={data?.kit.source.role ?? ""} />
      )}
    </div>
  );
}

export default function PracticePage() {
  const params = useParams<{ id: string }>();
  return (
    <RequireAuth>
      <PracticePageBody kitId={params.id} />
    </RequireAuth>
  );
}
