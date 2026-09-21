"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Spinner } from "@/components/ui/Spinner";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    router.replace(user ? "/kits" : "/login");
  }, [loading, user, router]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Spinner label="Loading…" />
    </div>
  );
}
