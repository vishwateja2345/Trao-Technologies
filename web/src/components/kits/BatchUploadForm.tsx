"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
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
      setError(err instanceof ApiError ? err.message : "Could not start batch generation.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">
        Upload a <code className="rounded bg-gray-100 px-1 py-0.5">.json</code> file (array of{" "}
        <code className="rounded bg-gray-100 px-1 py-0.5">{"{ jd, company_url, days }"}</code>) or a{" "}
        <code className="rounded bg-gray-100 px-1 py-0.5">.csv</code> with those column headers, to prepare for
        several roles at once.
      </p>
      <input
        ref={inputRef}
        type="file"
        accept=".json,.csv,text/csv,application/json"
        onChange={onFileChange}
        className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand/10 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand hover:file:bg-brand/20"
        aria-describedby="batch-file-help"
      />
      {error && <ErrorBanner message={error} />}
      {cases.length > 0 && !error && (
        <div className="rounded-lg border border-border bg-gray-50 p-3 text-sm text-gray-600">
          Parsed <strong>{cases.length}</strong> case(s) from <span className="font-mono">{fileName}</span>.
        </div>
      )}
      <Button onClick={onSubmit} disabled={cases.length === 0} loading={submitting} variant="secondary">
        Start {cases.length > 0 ? cases.length : ""} kit{cases.length === 1 ? "" : "s"}
      </Button>
    </div>
  );
}
