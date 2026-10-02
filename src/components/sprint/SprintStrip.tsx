import { ChevronDown, FileText, Play, Square } from 'lucide-react';
import type { SprintsModel } from '@/domain/selectors';
import type { ID } from '@/domain/types';
import { cn } from '@/lib/cn';
import { describeDue, formatRelative } from '@/lib/dates';
import { FOCUS_RING } from '@/ui/tokens';
import { Button } from '../ui/Button';
import { Menu, MenuAction, MenuButton, MenuLabel, MenuPanel } from '../ui/Menu';

/** Progress bar widths in twelfths, spelled out so Tailwind keeps every class. */
const WIDTHS = [
  'w-0',
  'w-1/12',
  'w-2/12',
  'w-3/12',
  'w-4/12',
  'w-5/12',
  'w-6/12',
  'w-7/12',
  'w-8/12',
  'w-9/12',
  'w-10/12',
  'w-11/12',
  'w-full',
];

/**
 * The sprint line under a list's title: the running sprint with its progress, or a
 * "no sprint" note, plus a menu of finished sprints' reports. Admins also get the
 * Start and End buttons. Props only; the dialogs they open are mounted elsewhere.
 */
export function SprintStrip({
  active,
  past,
  isAdmin,
  onStart,
  onEnd,
  onOpenReport,
}: {
  active: SprintsModel['active'];
  past: SprintsModel['past'];
  isAdmin: boolean;
  onStart: () => void;
  onEnd: () => void;
  onOpenReport: (sprintId: ID) => void;
}) {
  const due = active?.sprint.endsOn ? describeDue(active.sprint.endsOn) : null;

  return (
    <div role="group" aria-label="Sprint" className="flex shrink-0 flex-wrap items-center gap-3 px-6 pt-3">
      {active ? (
        <>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
            {active.sprint.name}
          </span>
          <span className="text-xs tabular-nums text-ink-muted">
            {active.done}/{active.total} done
          </span>
          <span className="h-1 w-32 overflow-hidden rounded-full bg-surface-sunken" aria-hidden>
            <span
              className={cn(
                'block h-full rounded-full bg-emerald-500 transition-all',
                WIDTHS[active.total ? Math.round((active.done / active.total) * 12) : 0],
              )}
            />
          </span>
          <span className={cn('text-xs', due?.tone === 'overdue' ? 'font-medium text-rose-600' : 'text-ink-subtle')}>
            {due
              ? due.tone === 'overdue'
                ? `Was due ${due.label}`
                : `Ends ${due.label}`
              : `Started ${formatRelative(active.sprint.startedAt)}`}
          </span>
          {isAdmin && (
            <Button size="sm" onClick={onEnd}>
              <Square className="h-3 w-3" aria-hidden /> End sprint
            </Button>
          )}
        </>
      ) : (
        <>
          <span className="text-xs text-ink-subtle">No sprint running</span>
          {isAdmin && (
            <Button size="sm" onClick={onStart}>
              <Play className="h-3 w-3" aria-hidden /> Start sprint
            </Button>
          )}
        </>
      )}

      {past.length > 0 && (
        <Menu>
          <MenuButton
            className={cn(
              'ml-auto flex h-7 items-center gap-1.5 rounded-control px-2 text-xs font-medium text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink data-[open]:bg-surface-sunken',
              FOCUS_RING,
            )}
          >
            <FileText className="h-3.5 w-3.5" aria-hidden /> Sprint reports ({past.length})
            <ChevronDown className="h-3 w-3 opacity-60" aria-hidden />
          </MenuButton>
          <MenuPanel className="w-80">
            <MenuLabel>Finished sprints</MenuLabel>
            {past.map((s) => (
              <MenuAction
                key={s.id}
                icon={<FileText className="h-3.5 w-3.5" />}
                hint={s.report ? `${s.report.done} done · ${s.report.spilled} spilled` : undefined}
                onClick={() => onOpenReport(s.id)}
              >
                {s.name}
              </MenuAction>
            ))}
          </MenuPanel>
        </Menu>
      )}
    </div>
  );
}
