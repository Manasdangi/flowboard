import { Plus } from 'lucide-react';
import { useRef, useState } from 'react';
import { TITLE_MAX } from '@/domain/tasks';
import type { ID } from '@/domain/types';
import { cn } from '@/lib/cn';
import { useActions } from '@/store/hooks';
import { FOCUS_RING } from '@/ui/tokens';

/** Inline "add task" for a column. Enter adds and stays open for the next one; Escape closes. */
export function QuickAdd({
  listId,
  statusId,
  compact,
  autoOpen = false,
}: {
  listId: ID;
  statusId: ID;
  compact?: boolean;
  autoOpen?: boolean;
}) {
  const { createTask } = useActions();
  const [open, setOpen] = useState(autoOpen);
  const [title, setTitle] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);

  const submit = () => {
    if (!title.trim()) return setOpen(false);
    const result = createTask({ listId, statusId, title });
    if (!result.error) {
      setTitle('');
      ref.current?.focus();
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'flex w-full items-center gap-1.5 rounded-control px-2 text-xs font-medium text-ink-subtle transition-colors hover:bg-surface-sunken hover:text-ink',
          compact ? 'h-7' : 'h-8',
          FOCUS_RING,
        )}
      >
        <Plus className="h-3.5 w-3.5" /> Add task
      </button>
    );
  }

  return (
    <div className="animate-fade-in rounded-card bg-surface p-2 shadow-card ring-2 ring-brand-400">
      <textarea
        ref={ref}
        autoFocus
        rows={2}
        value={title}
        maxLength={TITLE_MAX}
        placeholder="Task title…"
        aria-label="New task title"
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => !title.trim() && setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
          if (e.key === 'Escape') {
            e.stopPropagation();
            setTitle('');
            setOpen(false);
          }
        }}
        className="w-full resize-none bg-transparent text-sm leading-snug text-ink placeholder:text-ink-faint focus:outline-none"
      />
      <div className="flex items-center justify-between pt-1 text-2xs text-ink-subtle">
        <span>Enter to add · Esc to cancel</span>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={submit}
          className="rounded bg-brand-600 px-2 py-1 font-semibold text-white hover:bg-brand-700"
        >
          Add
        </button>
      </div>
    </div>
  );
}
