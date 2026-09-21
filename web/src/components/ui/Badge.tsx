import clsx from "clsx";

type Tone = "neutral" | "brand" | "success" | "warning" | "danger";

const TONE_CLASSES: Record<Tone, string> = {
  neutral: "bg-gray-100 text-gray-700",
  brand: "bg-indigo-50 text-brand",
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-700",
  danger: "bg-red-50 text-red-700",
};

export function Badge({
  tone = "neutral",
  children,
  className,
  ...rest
}: { tone?: Tone; children: React.ReactNode; className?: string } & React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={clsx("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", TONE_CLASSES[tone], className)} {...rest}>
      {children}
    </span>
  );
}
