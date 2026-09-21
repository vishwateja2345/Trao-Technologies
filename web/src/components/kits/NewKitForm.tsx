"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Label, TextArea, TextInput } from "@/components/ui/Field";
import { ErrorBanner } from "@/components/ui/ErrorBanner";

export function NewKitForm() {
  const [jd, setJd] = useState("");
  const [companyUrl, setCompanyUrl] = useState("");
  const [days, setDays] = useState(5);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { kit } = await api.createKit({ jd, company_url: companyUrl, days });
      router.push(`/kits/${kit.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not start generation. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {error && <ErrorBanner message={error} />}
      <div>
        <Label htmlFor="jd">Job description</Label>
        <TextArea
          id="jd"
          required
          rows={10}
          placeholder="Paste the full job description here…"
          value={jd}
          onChange={(e) => setJd(e.target.value)}
        />
        <p className="mt-1 text-xs text-gray-400">{jd.length.toLocaleString()} characters</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="company_url">Company website</Label>
          <TextInput
            id="company_url"
            type="url"
            required
            placeholder="https://company.com"
            value={companyUrl}
            onChange={(e) => setCompanyUrl(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="days">Days until interview</Label>
          <TextInput
            id="days"
            type="number"
            min={1}
            max={120}
            required
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          />
        </div>
      </div>
      <Button type="submit" loading={submitting} disabled={!jd.trim() || !companyUrl.trim()}>
        Generate prep kit
      </Button>
    </form>
  );
}
