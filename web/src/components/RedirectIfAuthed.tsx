"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Spinner } from "./ui/Spinner";

/**
 * Guards the login/register pages against an already-authenticated visitor.
 * Without this, hitting /login while signed in showed the Navbar (which
 * renders whenever `user` is set) stacked on top of the login form itself —
 * confusing and redundant. Redirects to /kits instead, mirroring how
 * RequireAuth redirects a signed-out visitor away from protected pages.
 */
export function RedirectIfAuthed({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) router.replace("/kits");
  }, [loading, user, router]);

  if (loading || user) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner label="Checking your session…" />
      </div>
    );
  }

  return <>{children}</>;
}
