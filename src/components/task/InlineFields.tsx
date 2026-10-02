import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react';
import { CalendarPlus, Check, Flag, Pencil } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';
import { PRIORITIES, TITLE_MAX } from '@/domain/tasks';
import type { ID, Priority, Status } from '@/domain/types';
import { cn } from '@/lib/cn';
import { fromDateInput, toDateInput } from '@/lib/dates';
import { FOCUS_RING, PRIORITY_STYLES, STATUS_STYLES } from '@/ui/tokens';
import { DueDate, PriorityBadge, StatusIcon, StatusPill } from '../ui/Badges';
import { Button } from '../ui/Button';
import { Menu, MenuAction, MenuButton, MenuLabel, MenuPanel } from '../ui/Menu';

/**
 * Editors for a task's fields that work right where the task is shown (a board card or
 * a list row), so you don't have to open the drawer. They sit inside something that is
 * itself clickable and draggable, so each is wrapped in `Isolate`. Props only: the parent
 * saves the change.
 */

/**
 * Keeps clicks and presses inside from reaching the card or row around it, which would
 * open the drawer or start a drag. Menus and popovers render in a portal, but React
 * still bubbles their events through here, so they are covered too.
 */
export function Isolate({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={className} onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
      {children}
    </div>
  );
}

const TRIGGER = cn('rounded-md transition-colors hover:bg-surface-sunken data-[open]:bg-surface-sunken', FOCUS_RING);

/** An empty field shows only when its card or row is hovered or focused, so bare tasks stay tidy. */
const WHEN_HOVERED = 'opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 focus-visible:opacity-100';

/** Status as an icon or a pill; click to pick another status of the same list. */
export function StatusMenu({
  status,
  statuses,
  taskTitle,
  variant,
  onChange,
}: {
  status: Status | undefined;
  statuses: Status[];
  taskTitle: string;
  variant: 'icon' | 'pill';
  onChange: (statusId: ID) => void;
}) {
  return (
    <Isolate className="shrink-0">
      <Menu>
        <MenuButton
          aria-label={`Change status of ${taskTitle}`}
          title={`Status: ${status?.name ?? 'Unknown'}`}
          className={cn(TRIGGER, variant === 'icon' ? 'flex h-5 w-5 items-center justify-center' : 'rounded-full')}
        >
          {variant === 'pill' ? (
            <StatusPill status={status} />
          ) : (
            <StatusIcon
              category={status?.category ?? 'todo'}
              className={cn('h-4 w-4', status && STATUS_STYLES[status.color].text)}
            />
          )}
        </MenuButton>
        <MenuPanel anchor="bottom start" className="w-52">
          <MenuLabel>Status</MenuLabel>
          {statuses.map((s) => (
            <MenuAction
              key={s.id}
              icon={<StatusIcon category={s.category} className={STATUS_STYLES[s.color].text} />}
              hint={s.id === status?.id ? <Check className="h-3.5 w-3.5 text-brand-600" /> : undefined}
              onClick={() => s.id !== status?.id && onChange(s.id)}
            >
              {s.name}
            </MenuAction>
          ))}
        </MenuPanel>
      </Menu>
    </Isolate>
  );
}

/** Priority badge; click to pick another priority. */
export function PriorityMenu({
  priority,
  taskTitle,
  onChange,
}: {
  priority: Priority;
  taskTitle: string;
  onChange: (priority: Priority) => void;
}) {
  return (
    <Isolate className="shrink-0">
      <Menu>
        <MenuButton
          aria-label={`Change priority of ${taskTitle}`}
          title="Change priority"
          className={cn(TRIGGER, priority === 'none' && cn('flex h-5 w-5 items-center justify-center', WHEN_HOVERED))}
        >
          {priority === 'none' ? (
            <Flag className="h-3.5 w-3.5 text-ink-faint" aria-hidden />
          ) : (
            <PriorityBadge priority={priority} />
          )}
        </MenuButton>
        <MenuPanel anchor="bottom start" className="w-44">
          <MenuLabel>Priority</MenuLabel>
          {PRIORITIES.map((p) => (
            <MenuAction
              key={p}
              icon={<Flag className={`h-3.5 w-3.5 ${PRIORITY_STYLES[p].icon}`} />}
              hint={p === priority ? <Check className="h-3.5 w-3.5 text-brand-600" /> : undefined}
              onClick={() => p !== priority && onChange(p)}
            >
              {PRIORITY_STYLES[p].label}
            </MenuAction>
          ))}
        </MenuPanel>
      </Menu>
    </Isolate>
  );
}

/** Due date; click to pick or clear it. */
export function DueDatePopover({
  iso,
  done,
  taskTitle,
  onChange,
}: {
  iso: string | null;
  done: boolean;
  taskTitle: string;
  onChange: (iso: string | null) => void;
}) {
  return (
    <Isolate className="shrink-0">
      <Popover className="relative">
        <PopoverButton
          aria-label={`Change due date of ${taskTitle}`}
          title="Change due date"
          className={cn(TRIGGER, 'flex items-center px-1 py-0.5', !iso && WHEN_HOVERED)}
        >
          {iso ? (
            <DueDate iso={iso} done={done} />
          ) : (
            <CalendarPlus className="h-3.5 w-3.5 text-ink-faint" aria-hidden />
          )}
        </PopoverButton>
        <PopoverPanel
          focus
          anchor={{ to: 'bottom start', gap: 6 }}
          className="z-50 rounded-card bg-surface p-2 shadow-pop"
        >
          {({ close }) => (
            <div className="flex items-center gap-2">
              <input
                type="date"
                autoFocus
                aria-label="Due date"
                value={toDateInput(iso)}
                onChange={(e) => {
                  // While a year is being typed the browser reports 0002, 0020, 0202…; wait for a real one.
                  const value = e.target.value;
                  if (value && Number(value.slice(0, 4)) >= 1000) onChange(fromDateInput(value));
                }}
                onKeyDown={(e) => e.key === 'Enter' && close()}
                className="h-8 cursor-pointer rounded-control bg-surface px-2.5 text-sm text-ink ring-1 ring-inset ring-line-strong hover:ring-ink-faint focus:outline-none focus:ring-2 focus:ring-brand-500 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
              />
              {iso && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    onChange(null);
                    close();
                  }}
                >
                  Clear
                </Button>
              )}
            </div>
          )}
        </PopoverPanel>
      </Popover>
    </Isolate>
  );
}

/**
 * The task title with a pencil to rename it in place. Enter or clicking away saves,
 * Escape cancels. Saving is the parent's job, which also reports an empty title.
 */
export function InlineTitle({
  value,
  textClassName,
  onSave,
}: {
  value: string;
  /** Classes for the title text itself (size, strike-through…). */
  textClassName?: string;
  onSave: (title: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const finished = useRef(false); // Enter and the blur it causes must not save twice

  const finish = (save: boolean) => {
    if (finished.current) return;
    finished.current = true;
    setEditing(false);
    if (save && draft.trim() !== value) onSave(draft.trim());
  };

  if (editing) {
    return (
      <Isolate className="min-w-0 flex-1">
        <input
          autoFocus
          aria-label="Edit task title"
          value={draft}
          maxLength={TITLE_MAX}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => finish(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') finish(true);
            if (e.key === 'Escape') finish(false);
          }}
          className="h-7 w-full rounded-control bg-surface px-2 text-sm font-medium text-ink ring-2 ring-brand-500 focus:outline-none"
        />
      </Isolate>
    );
  }

  return (
    <span className="flex min-w-0 items-start gap-1">
      <span className={cn('min-w-0 break-words', textClassName)}>{value}</span>
      <Isolate className="shrink-0">
        <button
          type="button"
          aria-label="Edit title"
          title="Rename"
          onClick={() => {
            finished.current = false;
            setDraft(value);
            setEditing(true);
          }}
          className={cn(
            'flex h-5 w-5 items-center justify-center rounded text-ink-faint hover:bg-surface-sunken hover:text-ink',
            WHEN_HOVERED,
            FOCUS_RING,
          )}
        >
          <Pencil className="h-3 w-3" aria-hidden />
        </button>
      </Isolate>
    </span>
  );
}
