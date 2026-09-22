import { forwardRef } from "react";
import clsx from "clsx";

// Inputs read like labeled fields on a control panel: rectangular, a
// visible rule border, focus resolves to the amber indicator rather than
// a generic blue ring.
const fieldClasses =
  "w-full rounded-sm border border-rule-strong bg-panel px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-amber focus:outline-none focus:ring-2 focus:ring-amber/25";

export const TextInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function TextInput(
  { className, ...props },
  ref
) {
  return <input ref={ref} className={clsx(fieldClasses, className)} {...props} />;
});

export const TextArea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function TextArea({ className, ...props }, ref) {
    return <textarea ref={ref} className={clsx(fieldClasses, className)} {...props} />;
  }
);

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...props },
  ref
) {
  return (
    <select ref={ref} className={clsx(fieldClasses, className)} {...props}>
      {children}
    </select>
  );
});

export function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium text-ink">
      {children}
    </label>
  );
}
