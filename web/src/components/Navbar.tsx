"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Button } from "./ui/Button";

// The board's header strip: a thin amber indicator line along the top
// edge (the illuminated strip on a real departure-board cabinet), the
// wordmark set as a title plate in tracked mono.
export function Navbar() {
  const { user, logout, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  if (loading || !user) return null;

  return (
    <header className="sticky top-0 z-20 border-b border-rule bg-panel">
      <div className="h-[3px] bg-amber" aria-hidden="true" />
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6" aria-label="Primary">
        <Link href="/kits" className="flex items-center gap-2 font-mono text-sm font-semibold uppercase tracking-widest text-ink">
          <span className="inline-block h-2 w-2 rounded-full bg-amber" aria-hidden="true" />
          PrepKit
        </Link>
        <div className="flex items-center gap-4">
          <Link
            href="/kits"
            className={`font-mono text-xs uppercase tracking-wider ${
              pathname === "/kits" ? "text-amber-strong" : "text-ink-muted hover:text-ink"
            }`}
          >
            My kits
          </Link>
          <span className="hidden font-mono text-xs text-ink-faint sm:inline">{user.email}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await logout();
              router.push("/login");
            }}
          >
            Sign out
          </Button>
        </div>
      </nav>
    </header>
  );
}
