// A small sequence of "flap characters" resolving in turn — the loading
// motif for this board system, in place of a generic spinner.
export function Spinner({ label = "Loading…", className }: { label?: string; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 text-sm text-ink-muted ${className ?? ""}`} role="status">
      <span className="flex gap-0.5" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-3 w-2 rounded-[1px] border border-amber-strong bg-amber-tint"
            style={{
              animation: "flap-flip 0.9s cubic-bezier(0.16,1,0.3,1) infinite",
              animationDelay: `${i * 0.15}s`,
            }}
          />
        ))}
      </span>
      <span className="font-mono text-xs uppercase tracking-wider">{label}</span>
    </span>
  );
}
