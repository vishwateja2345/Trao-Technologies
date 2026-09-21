export function Spinner({ label = "Loading…", className }: { label?: string; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 text-sm text-gray-500 ${className ?? ""}`} role="status">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}
