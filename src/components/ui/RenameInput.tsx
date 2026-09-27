import { useEffect, useRef, useState } from 'react';

/** Inline rename field: Enter or blur saves, Escape cancels (`onDone(null)`). */
export function RenameInput({ initial, onDone }: { initial: string; onDone: (name: string | null) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(initial);
  const done = useRef(false);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  const finish = (name: string | null) => {
    if (done.current) return;
    done.current = true;
    onDone(name);
  };
  return (
    <input
      ref={ref}
      value={value}
      aria-label="Rename"
      maxLength={80}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => finish(value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') finish(value);
        if (e.key === 'Escape') finish(null);
      }}
      className="h-6 min-w-0 flex-1 rounded bg-surface px-1.5 text-sm text-ink ring-2 ring-brand-500 focus:outline-none"
    />
  );
}
