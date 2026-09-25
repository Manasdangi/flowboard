import { CalendarDays, CheckCircle2, Circle, CircleDashed, CircleDot, Flag } from 'lucide-react';
import type { Priority, Status, StatusCategory } from '@/domain/types';
import { describeDue } from '@/lib/dates';
import { cn } from '@/lib/cn';
import { PRIORITY_STYLES, STATUS_STYLES } from '@/ui/tokens';

export function StatusIcon({ category, className }: { category: StatusCategory; className?: string }) {
  const Icon = category === 'done' ? CheckCircle2 : category === 'in_progress' ? CircleDot : Circle;
  return <Icon className={cn('h-3.5 w-3.5 shrink-0', className)} aria-hidden />;
}

export function StatusPill({ status, className }: { status: Status | undefined; className?: string }) {
  if (!status) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-medium text-ink-subtle ring-1 ring-inset ring-line',
          className,
        )}
      >
        <CircleDashed className="h-3 w-3" aria-hidden /> Unknown
      </span>
    );
  }
  const s = STATUS_STYLES[status.color];
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-semibold ring-1 ring-inset',
        s.pill,
        className,
      )}
    >
      <StatusIcon category={status.category} className="h-3 w-3" />
      <span className="truncate">{status.name}</span>
    </span>
  );
}

export function PriorityBadge({
  priority,
  compact = false,
  className,
}: {
  priority: Priority;
  compact?: boolean;
  className?: string;
}) {
  const p = PRIORITY_STYLES[priority];
  if (priority === 'none' && compact) return null;
  return (
    <span
      title={`Priority: ${p.label}`}
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-2xs font-semibold ring-1 ring-inset',
        p.badge,
        className,
      )}
    >
      <Flag className={cn('h-3 w-3', p.icon)} aria-hidden fill={priority === 'urgent' ? 'currentColor' : 'none'} />
      {p.label}
    </span>
  );
}

const DUE_TONES = {
  overdue: 'text-rose-600',
  today: 'text-orange-600',
  soon: 'text-amber-700',
  later: 'text-ink-muted',
  done: 'text-ink-subtle',
};

export function DueDate({ iso, done, className }: { iso: string | null; done?: boolean; className?: string }) {
  if (!iso) return <span className={cn('text-xs text-ink-faint', className)}>—</span>;
  const d = describeDue(iso, { done });
  return (
    <span
      title={`Due ${d.full}`}
      className={cn('inline-flex items-center gap-1 text-xs font-medium', DUE_TONES[d.tone], className)}
    >
      <CalendarDays className="h-3.5 w-3.5" aria-hidden />
      {d.label}
    </span>
  );
}
