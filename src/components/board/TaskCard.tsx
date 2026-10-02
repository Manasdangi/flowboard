import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ListChecks, Loader2 } from 'lucide-react';
import { forwardRef, type HTMLAttributes } from 'react';
import type { TaskFields } from '@/domain/tasks';
import type { ID, Status, Task, User } from '@/domain/types';
import { cn } from '@/lib/cn';
import { FOCUS_RING } from '@/ui/tokens';
import { AvatarStack } from '../ui/Avatar';
import { DueDate, PriorityBadge } from '../ui/Badges';
import { AssigneePicker } from '../task/AssigneePicker';
import { DueDatePopover, InlineTitle, Isolate, PriorityMenu, StatusMenu } from '../task/InlineFields';

/** What a card needs to let you change a task in place. Leave it out for a read-only copy (the drag preview). */
export interface TaskEditor {
  /** The list's statuses. */
  statuses: Status[];
  /** People who can be assigned (they can see the list). */
  people: User[];
  users: Record<ID, User>;
  onChange: (patch: Partial<TaskFields>) => void;
}

export interface CardProps {
  task: Task;
  assignees: User[];
  done: boolean;
  progress?: { done: number; total: number };
  pending?: boolean;
  editor?: TaskEditor;
}

/** Presentational card — used in columns and as the drag overlay. */
export const TaskCardBody = forwardRef<
  HTMLDivElement,
  CardProps & HTMLAttributes<HTMLDivElement> & { overlay?: boolean; placeholder?: boolean }
>(function TaskCardBody(
  { task, assignees, done, progress, pending, editor, overlay, placeholder, className, ...rest },
  ref,
) {
  const titleClass = cn(
    'line-clamp-3 text-sm font-medium leading-snug text-ink',
    done && 'text-ink-muted line-through decoration-ink-faint',
  );
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
      {editor ? (
        <div className="flex items-start gap-1.5">
          <StatusMenu
            status={editor.statuses.find((s) => s.id === task.statusId)}
            statuses={editor.statuses}
            taskTitle={task.title}
            variant="icon"
            onChange={(statusId) => editor.onChange({ statusId })}
          />
          <InlineTitle value={task.title} textClassName={titleClass} onSave={(title) => editor.onChange({ title })} />
        </div>
      ) : (
        <p className={titleClass}>{task.title}</p>
      )}
      {(editor || task.priority !== 'none' || task.dueDate || progress || assignees.length > 0 || pending) && (
        <div className="mt-2.5 flex min-h-6 items-center gap-2">
          {editor ? (
            <PriorityMenu
              priority={task.priority}
              taskTitle={task.title}
              onChange={(priority) => editor.onChange({ priority })}
            />
          ) : (
            <PriorityBadge priority={task.priority} compact />
          )}
          {editor ? (
            <DueDatePopover
              iso={task.dueDate}
              done={done}
              taskTitle={task.title}
              onChange={(dueDate) => editor.onChange({ dueDate })}
            />
          ) : (
            task.dueDate && <DueDate iso={task.dueDate} done={done} />
          )}
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
            {editor ? (
              <Isolate>
                <AssigneePicker
                  compact
                  assigneeIds={task.assigneeIds}
                  candidates={editor.people}
                  users={editor.users}
                  onChange={(assigneeIds) => editor.onChange({ assigneeIds })}
                />
              </Isolate>
            ) : (
              <AvatarStack users={assignees} />
            )}
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
        // Keys typed into a control inside the card (the title editor, a menu) are not the card's. Without
        // this, a space in the title would start a keyboard drag, since the sensor accepts any target.
        if (e.target !== e.currentTarget) return;
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
