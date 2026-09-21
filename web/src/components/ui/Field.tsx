import { forwardRef } from "react";
import clsx from "clsx";

export const TextInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function TextInput(
  { className, ...props },
  ref
) {
  return (
    <input
      ref={ref}
      className={clsx(
        "w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground placeholder:text-gray-400",
        "focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20",
        className
      )}
      {...props}
    />
  );
});

export const TextArea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function TextArea({ className, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        className={clsx(
          "w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground placeholder:text-gray-400",
          "focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20",
          className
        )}
        {...props}
      />
    );
  }
);

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...props },
  ref
) {
  return (
    <select
      ref={ref}
      className={clsx(
        "w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground",
        "focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
});

export function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium text-foreground">
      {children}
    </label>
  );
}
