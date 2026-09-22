"use client";

import { forwardRef } from "react";
import clsx from "clsx";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

// Rectangular, plate-like buttons with a hard offset shadow and a visible
// press state (shadow collapses, button nudges down) — a physical switch,
// not a soft app-store pill.
const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    "bg-amber text-panel border border-amber-strong shadow-[2px_2px_0_var(--amber-strong)] hover:bg-amber-strong active:shadow-none active:translate-x-[2px] active:translate-y-[2px] disabled:bg-ink-faint disabled:border-ink-faint disabled:shadow-none",
  secondary:
    "bg-panel text-ink border border-rule-strong shadow-[2px_2px_0_var(--rule-strong)] hover:bg-panel-recessed active:shadow-none active:translate-x-[2px] active:translate-y-[2px] disabled:opacity-50 disabled:shadow-none",
  ghost: "bg-transparent text-ink-muted border border-transparent hover:bg-panel-recessed hover:text-ink disabled:opacity-50",
  danger:
    "bg-signal-danger text-panel border border-[#6f2c20] shadow-[2px_2px_0_#6f2c20] hover:brightness-110 active:shadow-none active:translate-x-[2px] active:translate-y-[2px] disabled:bg-ink-faint disabled:border-ink-faint disabled:shadow-none",
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: "px-2.5 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", loading, disabled, children, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      className={clsx(
        "inline-flex items-center justify-center gap-1.5 rounded font-medium transition-[transform,box-shadow,background-color] cursor-pointer",
        "disabled:cursor-not-allowed",
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && (
        <span
          className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
        />
      )}
      {children}
    </button>
  );
});
