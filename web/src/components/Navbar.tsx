"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Button } from "./ui/Button";

export function Navbar() {
  const { user, logout, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  if (loading || !user) return null;

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-surface/90 backdrop-blur">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6" aria-label="Primary">
        <Link href="/kits" className="text-sm font-semibold tracking-tight text-foreground">
          <span className="text-brand">Prep</span>Kit
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/kits"
            className={`text-sm font-medium ${pathname === "/kits" ? "text-brand" : "text-gray-500 hover:text-foreground"}`}
          >
            My kits
          </Link>
          <span className="hidden text-sm text-gray-400 sm:inline">{user.email}</span>
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
