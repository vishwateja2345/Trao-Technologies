"use client";

import { useRef, useState } from "react";

/**
 * Local-first text editing: the input updates instantly from keystrokes
 * (no round trip per character), and the save callback fires only after
 * the user pauses typing or blurs. This is what makes editing "feel
 * immediate" (Section 12) instead of janky while still persisting reliably.
 */
export function useDebouncedField(initialValue: string, onSave: (value: string) => void, delayMs = 700) {
  // React's documented "adjusting state during render" pattern: this resets
  // local state when the server-provided value changes identity (e.g. after
  // a refetch), without the extra render/flash a useEffect-based reset would
  // cause.
  const [prevInitialValue, setPrevInitialValue] = useState(initialValue);
  const [value, setValue] = useState(initialValue);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef(initialValue);

  if (initialValue !== prevInitialValue) {
    setPrevInitialValue(initialValue);
    setValue(initialValue);
    // Safe per React's documented ref rules: written only once per actual
    // identity change and never read during this same render pass. The
    // React Compiler isn't enabled in this project, so this lint rule's
    // stricter (compiler-oriented) assumption doesn't apply here.
    // eslint-disable-next-line react-hooks/refs
    lastSavedRef.current = initialValue;
  }

  function handleChange(next: string) {
    setValue(next);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (next !== lastSavedRef.current) {
        lastSavedRef.current = next;
        onSave(next);
      }
    }, delayMs);
  }

  function flush() {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (value !== lastSavedRef.current) {
      lastSavedRef.current = value;
      onSave(value);
    }
  }

  return { value, handleChange, flush };
}
