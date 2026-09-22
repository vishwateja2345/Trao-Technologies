import clsx from "clsx";

type Tone = "neutral" | "brand" | "success" | "warning" | "danger";

// Gate-indicator plates: rectangular, 1px border in the status color,
// uppercase tracked monospace — the board's status-code vocabulary. This
// is the one place mono-for-everything is correct: these ARE codes, not
// prose ("READY", "MUST", "GAP"), not a technical costume.
const TONE_CLASSES: Record<Tone, string> = {
  neutral: "border-rule-strong bg-panel-recessed text-ink-muted",
  brand: "border-amber-strong bg-amber-tint text-amber-strong",
  success: "border-signal-ok bg-signal-ok-tint text-signal-ok",
  warning: "border-amber-strong bg-amber-tint text-amber-strong",
  danger: "border-signal-danger bg-signal-danger-tint text-signal-danger",
};

export function Badge({
  tone = "neutral",
  prose = false,
  children,
  className,
  ...rest
}: {
  tone?: Tone;
  /** Set true when the badge carries real freeform content (e.g. a linked
   * requirement's own text) rather than a short status code — switches off
   * the uppercase/mono/tracking treatment so long sentences stay readable. */
  prose?: boolean;
  children: React.ReactNode;
  className?: string;
} & React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[0.6875rem] font-medium",
        prose ? "font-sans normal-case tracking-normal" : "font-mono uppercase tracking-wider",
        TONE_CLASSES[tone],
        className
      )}
      {...rest}
    >
      {children}
    </span>
  );
}
