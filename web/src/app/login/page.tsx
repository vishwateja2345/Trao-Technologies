"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, getErrorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { RedirectIfAuthed } from "@/components/RedirectIfAuthed";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Label, TextInput } from "@/components/ui/Field";
import { ErrorBanner } from "@/components/ui/ErrorBanner";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { refresh } = useAuth();
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.login(email, password);
      await refresh();
      router.push("/kits");
    } catch (err) {
      setError(getErrorMessage(err, "Could not sign in. Please try again."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center">
      <h1 className="mb-1 text-xl font-semibold tracking-tight text-ink">Welcome back</h1>
      <p className="mb-6 text-sm text-ink-muted">Sign in to see your interview prep kits.</p>
      <Card className="overflow-hidden">
        <div className="h-[3px] bg-amber" aria-hidden="true" />
        <form onSubmit={onSubmit} className="space-y-4 p-6" noValidate>
          {error && <ErrorBanner message={error} />}
          <div>
            <Label htmlFor="email">Email</Label>
            <TextInput id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <TextInput
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" loading={submitting}>
            Sign in
          </Button>
        </form>
      </Card>
      <p className="mt-4 text-center text-sm text-ink-muted">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="font-medium text-amber-strong hover:underline">
          Register
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <RedirectIfAuthed>
      <LoginForm />
    </RedirectIfAuthed>
  );
}
