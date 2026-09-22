"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, getErrorMessage } from "@/lib/api";
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

  const daysValid = Number.isInteger(days) && days >= 1 && days <= 120;
  const canSubmit = jd.trim().length > 0 && companyUrl.trim().length > 0 && daysValid;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setSubmitting(true);
    try {
      const { kit } = await api.createKit({ jd, company_url: companyUrl, days });
      router.push(`/kits/${kit.id}`);
    } catch (err) {
      setError(getErrorMessage(err, "Could not start generation. Please try again."));
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
        <p className="mt-1 font-mono text-xs text-ink-faint">{jd.length.toLocaleString()} chars</p>
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
          {!daysValid && <p className="mt-1 text-xs text-signal-danger">Enter a whole number of days between 1 and 120.</p>}
        </div>
      </div>
      <Button type="submit" loading={submitting} disabled={!canSubmit}>
        Generate prep kit
      </Button>
    </form>
  );
}
