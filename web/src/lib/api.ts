/**
 * Thin fetch wrapper. Every call goes through the same-origin `/api/*`
 * path, which next.config.ts rewrites to the Express backend — so cookies
 * behave like a normal same-site session with no CORS dance in the browser.
 */

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) {
    super(message);
  }
}

interface ZodFlattenedError {
  formErrors?: string[];
  fieldErrors?: Record<string, string[] | undefined>;
}

/**
 * Extracts the most specific human-readable message available from a
 * caught error. Validation failures (400s) carry field-level detail in
 * `ApiError.details` (a flattened Zod error) — e.g. "Password must be at
 * least 8 characters" — which is far more useful than the generic
 * "Invalid registration input." top-level message alone. Every form's
 * catch block should use this instead of reading `err.message` directly.
 */
export function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    const details = err.details as ZodFlattenedError | undefined;
    const fieldMessages = Object.values(details?.fieldErrors ?? {})
      .flat()
      .filter((m): m is string => Boolean(m));
    const formMessages = details?.formErrors ?? [];
    const specific = [...formMessages, ...fieldMessages];
    if (specific.length > 0) return specific.join(" ");
    return err.message;
  }
  return fallback;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (res.status === 204) return undefined as T;

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = body?.error ?? {};
    throw new ApiError(res.status, err.code ?? "UNKNOWN_ERROR", err.message ?? "Something went wrong.", err.details);
  }
  return body as T;
}

export const api = {
  register: (email: string, password: string, name?: string) =>
    request<{ user: { id: string; email: string; name: string } }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, name }),
    }),
  login: (email: string, password: string) =>
    request<{ user: { id: string; email: string; name: string } }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  logout: () => request<void>("/auth/logout", { method: "POST" }),
  me: () => request<{ user: { id: string; email: string; name: string } }>("/auth/me"),

  createKit: (input: { jd: string; company_url: string; days: number }) =>
    request<{ kit: { id: string }; reused: boolean }>("/kits", { method: "POST", body: JSON.stringify(input) }),
  createBatch: (cases: Array<{ jd: string; company_url: string; days: number }>) =>
    request<{ kits: { id: string }[] }>("/kits/batch", { method: "POST", body: JSON.stringify({ cases }) }),
  listKits: () => request<{ kits: import("./types").KitSummary[] }>("/kits"),
  getKit: (id: string) => request<{ kit: import("./types").Kit }>(`/kits/${id}`),
  deleteKit: (id: string) => request<void>(`/kits/${id}`, { method: "DELETE" }),

  patchBrief: (id: string, patch: { summary?: string; what_they_do?: string; pinned?: boolean }) =>
    request(`/kits/${id}/brief`, { method: "PATCH", body: JSON.stringify(patch) }),

  addQuestion: (id: string, input: object) =>
    request(`/kits/${id}/questions`, { method: "POST", body: JSON.stringify(input) }),
  editQuestion: (id: string, qid: string, patch: object) =>
    request(`/kits/${id}/questions/${qid}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteQuestion: (id: string, qid: string) => request(`/kits/${id}/questions/${qid}`, { method: "DELETE" }),
  reorderQuestions: (id: string, category: string, ordered_ids: string[]) =>
    request(`/kits/${id}/questions/reorder`, { method: "POST", body: JSON.stringify({ category, ordered_ids }) }),

  addFlashcard: (id: string, input: object) =>
    request(`/kits/${id}/flashcards`, { method: "POST", body: JSON.stringify(input) }),
  editFlashcard: (id: string, fid: string, patch: object) =>
    request(`/kits/${id}/flashcards/${fid}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteFlashcard: (id: string, fid: string) => request(`/kits/${id}/flashcards/${fid}`, { method: "DELETE" }),

  regenerate: (id: string, section: string, opts?: { force?: boolean; days?: number }) =>
    request(`/kits/${id}/regenerate`, { method: "POST", body: JSON.stringify({ section, ...opts }) }),

  recordPractice: (id: string, flashcard_id: string, confidence: number) =>
    request(`/kits/${id}/practice`, { method: "POST", body: JSON.stringify({ flashcard_id, confidence }) }),
  practiceQueue: (id: string) =>
    request<{ queue: import("./types").PracticeQueueItem[] }>(`/kits/${id}/practice/queue`),
  weakSpots: (id: string) => request<{ report: import("./types").WeakSpotEntry[] }>(`/kits/${id}/weak-spots`),
};
