"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, getErrorMessage } from "@/lib/api";
import { parseBatchFile, type BatchCaseInput } from "@/lib/csv";
import { Button } from "@/components/ui/Button";
import { ErrorBanner } from "@/components/ui/ErrorBanner";

export function BatchUploadForm() {
  const [cases, setCases] = useState<BatchCaseInput[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setFileName(file.name);
    try {
      const text = await file.text();
      const parsed = parseBatchFile(file.name, text);
      setCases(parsed);
    } catch (err) {
      setCases([]);
      setError(err instanceof Error ? err.message : "Could not parse that file.");
    }
  }

  async function onSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const { kits } = await api.createBatch(cases);
      router.push("/kits");
      void kits;
    } catch (err) {
      setError(getErrorMessage(err, "Could not start batch generation."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-muted" id="batch-file-help">
        Upload a <code className="rounded-sm bg-panel-recessed px-1 py-0.5 font-mono text-xs">.json</code> file (array
        of <code className="rounded-sm bg-panel-recessed px-1 py-0.5 font-mono text-xs">{"{ jd, company_url, days }"}</code>) or
        a <code className="rounded-sm bg-panel-recessed px-1 py-0.5 font-mono text-xs">.csv</code> with those column
        headers, to prepare for several roles at once.
      </p>
      <input
        ref={inputRef}
        type="file"
        accept=".json,.csv,text/csv,application/json"
        onChange={onFileChange}
        className="block w-full text-sm text-ink-muted file:mr-3 file:rounded-sm file:border file:border-rule-strong file:bg-amber-tint file:px-3 file:py-2 file:text-xs file:font-mono file:uppercase file:tracking-wide file:text-amber-strong hover:file:bg-amber-tint/70"
        aria-label="Upload a file of job cases"
        aria-describedby="batch-file-help"
      />
      {error && <ErrorBanner message={error} />}
      {cases.length > 0 && !error && (
        <div className="rounded-sm border border-rule bg-panel-recessed p-3 text-sm text-ink-muted">
          Parsed <strong className="font-mono text-ink">{cases.length}</strong> case(s) from{" "}
          <span className="font-mono text-ink">{fileName}</span>.
        </div>
      )}
      <Button onClick={onSubmit} disabled={cases.length === 0} loading={submitting} variant="secondary">
        Start {cases.length > 0 ? cases.length : ""} kit{cases.length === 1 ? "" : "s"}
      </Button>
    </div>
  );
}
