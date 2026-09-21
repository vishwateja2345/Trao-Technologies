let counters: Record<string, number> = {};

/** Stable, sequential, human-readable ids (r1, r2, q1, q2, f1 ...) scoped per kit-build. */
export function resetIdCounters(): void {
  counters = {};
}

export function nextId(prefix: string): string {
  counters[prefix] = (counters[prefix] ?? 0) + 1;
  return `${prefix}${counters[prefix]}`;
}
