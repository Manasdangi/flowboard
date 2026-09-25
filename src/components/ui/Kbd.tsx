import type { ReactNode } from 'react';

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-b-2 border-line-strong bg-surface px-1 font-sans text-2xs font-medium text-ink-subtle">
      {children}
    </kbd>
  );
}
