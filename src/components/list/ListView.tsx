import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, ListChecks, Plus } from 'lucide-react';
import { useMemo, useState, type KeyboardEvent } from 'react';
import { selectListPage, type SortKey, type SortSpec } from '@/domain/selectors';
import { TITLE_MAX } from '@/domain/tasks';
import type { ID } from '@/domain/types';
import { cn } from '@/lib/cn';
import { useActions, useAppStore } from '@/store/hooks';
import { FOCUS_RING, STATUS_STYLES } from '@/ui/tokens';
import { AvatarStack } from '../ui/Avatar';
import { DueDate, PriorityBadge, StatusIcon, StatusPill } from '../ui/Badges';
import { Button } from '../ui/Button';

const PAGE_SIZE = 10;

const COLUMNS: { key: SortKey; label: string; className: string }[] = [
  { key: 'title', label: 'Task', className: 'w-auto' },
  { key: 'status', label: 'Status', className: 'w-40' },
  { key: 'manual', label: 'Assignees', className: 'w-28' },
  { key: 'priority', label: 'Priority', className: 'w-32' },
  { key: 'dueDate', label: 'Due date', className: 'w-32' },
];

const SORTABLE: SortKey[] = ['title', 'status', 'priority', 'dueDate'];

export function ListView({ listId, onOpenTask }: { listId: ID; onOpenTask: (id: ID) => void }) {
  const data = useAppStore((s) => s.data);
  const userId = useAppStore((s) => s.currentUserId);
  const [sort, setSort] = useState<SortSpec>({ key: 'manual', dir: 'asc' });
  const [pages, setPages] = useState(1);

  // Offset pagination over in-memory data: we ask the store for the first N pages.
  const page = useMemo(
    () => selectListPage(data, userId, listId, { sort, offset: 0, limit: pages * PAGE_SIZE }),
    [data, userId, listId, sort, pages],
  );
  if (page.error) return null; // ListScreen renders the 403 state before we get here.
  const { rows, total, nextOffset, subtaskProgress } = page.data;

  /** Clicking a sortable column header cycles: ascending → descending → back to manual order. */
  const cycleSort = (key: SortKey) => {
    if (!SORTABLE.includes(key)) return;
    setSort((current) => {
      if (current.key !== key) return { key, dir: 'asc' };
      if (current.dir === 'asc') return { key, dir: 'desc' };
      return { key: 'manual', dir: 'asc' };
    });
  };

  return (
    <div className="h-full overflow-y-auto px-6 pb-8 pt-4">
      <div className="overflow-hidden rounded-panel bg-surface shadow-card">
        <table className="w-full table-fixed border-collapse text-sm" data-testid="task-table">
          <thead className="sticky top-0 z-10 bg-surface-muted">
            <tr className="border-b border-line">
              {COLUMNS.map((col) => {
                const sortable = SORTABLE.includes(col.key);
                const active = sort.key === col.key;
                const Icon = !active ? ArrowUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown;
                return (
                  <th
                    key={col.label}
                    scope="col"
                    aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                    className={cn(
                      'px-4 py-2 text-left text-2xs font-semibold uppercase tracking-wide text-ink-subtle',
                      col.className,
                    )}
                  >
                    {sortable ? (
                      <button
                        type="button"
                        onClick={() => cycleSort(col.key)}
                        className={cn(
                          '-mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5 uppercase hover:bg-surface-sunken hover:text-ink',
                          active && 'text-brand-700',
                          FOCUS_RING,
                        )}
                      >
                        {col.label}
                        <Icon className={cn('h-3 w-3', !active && 'opacity-40')} aria-hidden />
                      </button>
                    ) : (
                      col.label
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((task) => {
              const status = data.statuses[task.statusId];
              const done = status?.category === 'done';
              const progress = subtaskProgress[task.id];
              const open = () => onOpenTask(task.id);
              const onKeyDown = (e: KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  open();
                }
              };
              return (
                <tr
                  key={task.id}
                  tabIndex={0}
                  onClick={open}
                  onKeyDown={onKeyDown}
                  aria-label={task.title}
                  data-testid="task-row"
                  className="group cursor-pointer border-b border-line transition-colors last:border-0 hover:bg-surface-muted focus-visible:bg-brand-50/60 focus-visible:outline-none active:bg-surface-sunken"
                >
                  <td className="px-4 py-2.5">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <StatusIcon
                        category={status?.category ?? 'todo'}
                        className={status ? STATUS_STYLES[status.color].text : ''}
                      />
                      <span
                        className={cn(
                          'truncate font-medium text-ink group-hover:text-brand-800',
                          done && 'text-ink-muted line-through decoration-ink-faint',
                        )}
                      >
                        {task.title}
                      </span>
                      {progress && (
                        <span className="inline-flex shrink-0 items-center gap-1 text-xs text-ink-subtle">
                          <ListChecks className="h-3.5 w-3.5" /> {progress.done}/{progress.total}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusPill status={status} />
                  </td>
                  <td className="px-4 py-2.5">
                    {task.assigneeIds.length ? (
                      <AvatarStack users={task.assigneeIds.map((id) => data.users[id]).filter(Boolean)} size="sm" />
                    ) : (
                      <span className="text-xs text-ink-faint">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    {task.priority === 'none' ? (
                      <span className="text-xs text-ink-faint">—</span>
                    ) : (
                      <PriorityBadge priority={task.priority} />
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <DueDate iso={task.dueDate} done={done} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <InlineCreate listId={listId} />
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-ink-subtle">
        <span>
          Showing <span className="font-semibold tabular-nums text-ink-muted">{rows.length}</span> of{' '}
          <span className="font-semibold tabular-nums text-ink-muted">{total}</span> tasks
          {sort.key !== 'manual' && (
            <>
              {' '}
              · sorted by {COLUMNS.find((c) => c.key === sort.key)?.label.toLowerCase()} (
              {sort.dir === 'asc' ? 'ascending' : 'descending'})
            </>
          )}
        </span>
        {nextOffset !== null && (
          <Button size="sm" onClick={() => setPages((p) => p + 1)}>
            <ChevronDown className="h-3.5 w-3.5" /> Load {Math.min(PAGE_SIZE, total - nextOffset)} more
          </Button>
        )}
      </div>
    </div>
  );
}

function InlineCreate({ listId }: { listId: ID }) {
  const { createTask } = useActions();
  const [title, setTitle] = useState('');
  const [focused, setFocused] = useState(false);
  const submit = () => {
    if (!title.trim()) return;
    if (!createTask({ listId, title }).error) setTitle('');
  };
  return (
    <div
      className={cn(
        'flex items-center gap-2.5 border-t border-line px-4 py-2 transition-colors',
        focused && 'bg-brand-50/40',
      )}
    >
      <Plus className="h-4 w-4 text-ink-faint" aria-hidden />
      <input
        value={title}
        maxLength={TITLE_MAX}
        placeholder="Add a task… (Enter to save)"
        aria-label="New task title"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit();
          if (e.key === 'Escape') setTitle('');
        }}
        className="h-7 flex-1 bg-transparent text-sm text-ink placeholder:text-ink-faint focus:outline-none"
      />
    </div>
  );
}
