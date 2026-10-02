import { Check, ChevronRight, Plus } from 'lucide-react';
import { useRef, useState } from 'react';
import { TITLE_MAX } from '@/domain/tasks';
import type { ID, Status, Task, User } from '@/domain/types';
import { cn } from '@/lib/cn';
import { FOCUS_RING } from '@/ui/tokens';
import { AvatarStack } from '../ui/Avatar';

/** One level of subtasks. Checking one moves it to the list's first "done" status. */
export function SubtaskList({
  subtasks,
  statuses,
  users,
  onOpen,
  onAddSubtask,
  onToggleSubtask,
}: {
  subtasks: Task[];
  statuses: Status[];
  users: Record<ID, User>;
  onOpen: (id: ID) => void;
  /** Returns whether the subtask was created. */
  onAddSubtask: (title: string) => boolean;
  onToggleSubtask: (taskId: ID, statusId: ID) => void;
}) {
  const [title, setTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const byId = Object.fromEntries(statuses.map((s) => [s.id, s]));
  const doneStatus = statuses.find((s) => s.category === 'done');
  const todoStatus = statuses.find((s) => s.category === 'todo') ?? statuses[0];
  const doneCount = subtasks.filter((t) => byId[t.statusId]?.category === 'done').length;

  const add = () => {
    if (!title.trim()) return;
    if (onAddSubtask(title)) setTitle('');
  };

  return (
    <section className="mt-7">
      <div className="mb-2 flex items-center gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">Subtasks</h3>
        {subtasks.length > 0 && (
          <>
            <span className="text-2xs tabular-nums text-ink-subtle">
              {doneCount}/{subtasks.length}
            </span>
            <span className="h-1 flex-1 overflow-hidden rounded-full bg-surface-sunken" aria-hidden>
              {/* Progress in fifths keeps this to static utility classes. */}
              <span
                className={cn(
                  'block h-full rounded-full bg-emerald-500 transition-all',
                  ['w-0', 'w-1/5', 'w-2/5', 'w-3/5', 'w-4/5', 'w-full'][Math.round((doneCount / subtasks.length) * 5)],
                )}
              />
            </span>
          </>
        )}
      </div>
      <ul className="divide-y divide-line rounded-card ring-1 ring-line">
        {subtasks.map((sub) => {
          const done = byId[sub.statusId]?.category === 'done';
          return (
            <li key={sub.id} className="group flex items-center gap-2.5 px-3 py-2 hover:bg-surface-muted">
              <button
                type="button"
                role="checkbox"
                aria-checked={done}
                aria-label={`Mark "${sub.title}" ${done ? 'not done' : 'done'}`}
                onClick={() => {
                  const target = done ? todoStatus : doneStatus;
                  if (target) onToggleSubtask(sub.id, target.id);
                }}
                className={cn(
                  'flex h-4 w-4 shrink-0 items-center justify-center rounded-full ring-1 ring-inset transition-colors',
                  FOCUS_RING,
                  done
                    ? 'bg-emerald-500 text-white ring-emerald-500'
                    : 'text-transparent ring-line-strong hover:text-emerald-400 hover:ring-emerald-400',
                )}
              >
                <Check className="h-3 w-3" strokeWidth={3} />
              </button>
              <button
                type="button"
                onClick={() => onOpen(sub.id)}
                className={cn('flex min-w-0 flex-1 items-center gap-2 rounded text-left text-sm', FOCUS_RING)}
              >
                <span className={cn('truncate', done ? 'text-ink-subtle line-through' : 'text-ink')}>{sub.title}</span>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink-faint opacity-0 group-hover:opacity-100" />
              </button>
              <AvatarStack users={sub.assigneeIds.map((id) => users[id]).filter(Boolean)} />
            </li>
          );
        })}
        <li className="flex items-center gap-2.5 px-3 py-1.5">
          <button
            type="button"
            aria-label="Add subtask"
            title="Add subtask"
            // With nothing typed there is nothing to add yet, so the plus just moves you to the field.
            onClick={() => (title.trim() ? add() : inputRef.current?.focus())}
            className={cn(
              'flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded text-ink-faint transition-colors hover:bg-surface-sunken hover:text-brand-600',
              FOCUS_RING,
            )}
          >
            <Plus className="h-4 w-4" aria-hidden />
          </button>
          <input
            ref={inputRef}
            value={title}
            maxLength={TITLE_MAX}
            aria-label="New subtask title"
            placeholder="Add subtask…"
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            className="h-7 flex-1 bg-transparent text-sm placeholder:text-ink-faint focus:outline-none"
          />
        </li>
      </ul>
    </section>
  );
}
