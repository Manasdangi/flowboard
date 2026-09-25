import { Check, ChevronRight, Plus } from 'lucide-react';
import { useState } from 'react';
import { TITLE_MAX } from '@/domain/tasks';
import type { ID, Status, Task } from '@/domain/types';
import { cn } from '@/lib/cn';
import { useActions, useAppStore } from '@/store/hooks';
import { FOCUS_RING } from '@/ui/tokens';
import { AvatarStack } from '../ui/Avatar';

/** One level of subtasks. Checking one moves it to the list's first "done" status. */
export function SubtaskList({
  parent,
  subtasks,
  statuses,
  onOpen,
}: {
  parent: Task;
  subtasks: Task[];
  statuses: Status[];
  onOpen: (id: ID) => void;
}) {
  const { createTask, updateTask } = useActions();
  const users = useAppStore((s) => s.data.users);
  const [title, setTitle] = useState('');
  const byId = Object.fromEntries(statuses.map((s) => [s.id, s]));
  const doneStatus = statuses.find((s) => s.category === 'done');
  const todoStatus = statuses.find((s) => s.category === 'todo') ?? statuses[0];
  const doneCount = subtasks.filter((t) => byId[t.statusId]?.category === 'done').length;

  const add = () => {
    if (!title.trim()) return;
    if (!createTask({ listId: parent.primaryListId, title, parentTaskId: parent.id }).error) setTitle('');
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
                  if (target) updateTask(sub.id, { statusId: target.id });
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
          <Plus className="h-4 w-4 text-ink-faint" aria-hidden />
          <input
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
