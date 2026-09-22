export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex items-start justify-between gap-3 rounded-md border border-signal-danger bg-signal-danger-tint px-4 py-3 text-sm text-signal-danger"
    >
      <span>{message}</span>
      {onRetry && (
        <button onClick={onRetry} className="shrink-0 font-medium underline underline-offset-2 hover:no-underline cursor-pointer">
          Retry
        </button>
      )}
    </div>
  );
}
