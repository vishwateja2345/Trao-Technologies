import clsx from "clsx";

// A "flap panel": crisp rectangle, thin rule border, hard offset shadow —
// a physical board module, not a soft floating card. `seam` renders the
// horizontal split-flap divider for components that read as literal board
// readouts (schedule days, flashcards).
export function Card({
  className,
  seam,
  children,
}: {
  className?: string;
  seam?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={clsx(
        "rounded-md border border-rule bg-panel shadow-[3px_3px_0_var(--rule)]",
        seam && "flap-seam",
        className
      )}
    >
      {children}
    </div>
  );
}
