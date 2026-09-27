import { Archive, ChevronRight, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import type { Container, ID } from '@/domain/types';
import { cn } from '@/lib/cn';
import { FOCUS_RING } from '@/ui/tokens';

/** Admin-only footer listing archived containers, each with a Restore button. */
export function ArchivedSection({ archived, onRestore }: { archived: Container[]; onRestore: (id: ID) => void }) {
  const [open, setOpen] = useState(false);
  if (archived.length === 0) return null;

  return (
    <div className="shrink-0 border-t border-line px-2 py-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={cn(
          'flex h-7 w-full items-center gap-1.5 rounded-control px-2 text-xs font-medium text-ink-muted hover:bg-surface-sunken hover:text-ink',
          FOCUS_RING,
        )}
      >
        <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-90')} />
        <Archive className="h-3.5 w-3.5" />
        <span className="flex-1 text-left">Archived</span>
        <span className="tabular-nums text-ink-faint">{archived.length}</span>
      </button>
      {open && (
        <ul className="mt-1 animate-fade-in space-y-px">
          {archived.map((c) => (
            <li
              key={c.id}
              className="group flex h-7 items-center gap-2 rounded-control pl-8 pr-1 text-xs text-ink-subtle hover:bg-surface-sunken"
            >
              <span className="min-w-0 flex-1 truncate line-through decoration-ink-faint">{c.name}</span>
              <span className="text-2xs capitalize text-ink-faint group-hover:hidden">{c.type}</span>
              <button
                type="button"
                onClick={() => onRestore(c.id)}
                className={cn(
                  'hidden h-6 items-center gap-1 rounded px-1.5 font-medium text-brand-700 hover:bg-brand-50 focus-visible:flex group-hover:flex',
                  FOCUS_RING,
                )}
              >
                <RotateCcw className="h-3 w-3" /> Restore
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
