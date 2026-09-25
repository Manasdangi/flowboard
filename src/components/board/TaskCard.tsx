import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ListChecks, Loader2 } from 'lucide-react';
import { forwardRef, type HTMLAttributes } from 'react';
import type { Task, User } from '@/domain/types';
import { cn } from '@/lib/cn';
import { FOCUS_RING } from '@/ui/tokens';
import { AvatarStack } from '../ui/Avatar';
import { DueDate, PriorityBadge } from '../ui/Badges';

export interface CardProps {
  task: Task;
  assignees: User[];
  done: boolean;
  progress?: { done: number; total: number };
  pending?: boolean;
}

/** Presentational card — used in columns and as the drag overlay. */
export const TaskCardBody = forwardRef<
  HTMLDivElement,
  CardProps & HTMLAttributes<HTMLDivElement> & { overlay?: boolean; placeholder?: boolean }
>(function TaskCardBody({ task, assignees, done, progress, pending, overlay, placeholder, className, ...rest }, ref) {
  return (
    <div
      ref={ref}
      className={cn(
        'group relative rounded-card bg-surface p-3 text-left shadow-card transition-[box-shadow,opacity]',
        !overlay && !placeholder && 'cursor-pointer hover:shadow-card-hover',
        FOCUS_RING,
        overlay && 'rotate-[1.5deg] cursor-grabbing shadow-drag',
        placeholder && 'bg-brand-50 opacity-50 shadow-none outline-dashed outline-2 outline-brand-300 [&>*]:invisible',
        className,
      )}
      {...rest}
    >
      <p
        className={cn(
          'line-clamp-3 text-sm font-medium leading-snug text-ink',
          done && 'text-ink-muted line-through decoration-ink-faint',
        )}
      >
        {task.title}
      </p>
      {(task.priority !== 'none' || task.dueDate || progress || assignees.length > 0 || pending) && (
        <div className="mt-2.5 flex min-h-6 items-center gap-2">
          <PriorityBadge priority={task.priority} compact />
          {task.dueDate && <DueDate iso={task.dueDate} done={done} />}
          {progress && (
            <span
              title={`${progress.done} of ${progress.total} subtasks done`}
              className={cn(
                'inline-flex items-center gap-1 text-xs font-medium',
                progress.done === progress.total ? 'text-emerald-600' : 'text-ink-subtle',
              )}
            >
              <ListChecks className="h-3.5 w-3.5" aria-hidden />
              {progress.done}/{progress.total}
            </span>
          )}
          <span className="ml-auto flex items-center gap-1.5">
            {pending && <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-500" aria-label="Saving" />}
            <AvatarStack users={assignees} />
          </span>
        </div>
      )}
    </div>
  );
});

export function SortableTaskCard({ onOpen, ...card }: CardProps & { onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.task.id,
    data: { type: 'task', statusId: card.task.statusId },
  });
  return (
    <TaskCardBody
      ref={setNodeRef}
      {...card}
      placeholder={isDragging}
      // dnd-kit requires inline transform/transition on the sortable node (documented exception).
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...attributes}
      {...listeners}
      aria-roledescription="Draggable task"
      aria-label={card.task.title}
      data-testid="task-card"
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          onOpen();
          return;
        }
        listeners?.onKeyDown?.(e);
      }}
    />
  );
}
