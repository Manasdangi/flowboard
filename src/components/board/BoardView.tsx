import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Inbox, Plus } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import type { BoardModel } from '@/domain/selectors';
import type { ID, Status, Task } from '@/domain/types';
import { cn } from '@/lib/cn';
import { useActions, useAppStore } from '@/store/hooks';
import { STATUS_STYLES } from '@/ui/tokens';
import { StatusIcon } from '../ui/Badges';
import { QuickAdd } from './QuickAdd';
import { SortableTaskCard, TaskCardBody } from './TaskCard';

type Columns = Record<ID, ID[]>;

/**
 * Kanban board. During a drag we keep a local copy of the column → task ids
 * mapping so cards visibly move between columns (onDragOver); on drop we make
 * ONE store call — moveTask — which applies optimistically and persists.
 */
export function BoardView({ board, onOpenTask }: { board: BoardModel; onOpenTask: (id: ID) => void }) {
  const { moveTask } = useActions();
  const users = useAppStore((s) => s.data.users);
  const tasks = useAppStore((s) => s.data.tasks);
  const pending = useAppStore((s) => s.pendingTaskIds);

  const base = useMemo<Columns>(
    () => Object.fromEntries(board.columns.map((c) => [c.status.id, c.tasks.map((t) => t.id)])),
    [board.columns],
  );
  const [dragColumns, setDragColumns] = useState<Columns | null>(null);
  const [activeId, setActiveId] = useState<ID | null>(null);
  const [overColumn, setOverColumn] = useState<ID | null>(null);
  const columns = dragColumns ?? base;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      // Enter opens a card, so only Space picks it up.
      keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space', 'Enter'] },
    }),
  );

  const columnOf = (id: UniqueIdentifier | undefined, cols: Columns): ID | null => {
    if (id === undefined) return null;
    const key = String(id);
    if (key in cols) return key;
    return Object.keys(cols).find((col) => cols[col].includes(key)) ?? null;
  };

  const reset = () => {
    setDragColumns(null);
    setActiveId(null);
    setOverColumn(null);
  };

  const onDragStart = ({ active }: DragStartEvent) => {
    setActiveId(String(active.id));
    setDragColumns(base);
    setOverColumn(columnOf(active.id, base));
  };

  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over || !dragColumns) return;
    const from = columnOf(active.id, dragColumns);
    const to = columnOf(over.id, dragColumns);
    setOverColumn(to);
    if (!from || !to || from === to) return;

    // Card crosses into another column: move it there at the hovered position.
    setDragColumns((prev) => {
      if (!prev) return prev;
      const target = prev[to];
      const overIndex = target.indexOf(String(over.id));
      const translated = active.rect.current.translated;
      const below = translated && overIndex >= 0 ? translated.top > over.rect.top + over.rect.height / 2 : false;
      const index = overIndex >= 0 ? overIndex + (below ? 1 : 0) : target.length;
      const nextTarget = [...target];
      nextTarget.splice(index, 0, String(active.id));
      return { ...prev, [from]: prev[from].filter((id) => id !== active.id), [to]: nextTarget };
    });
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    const cols = dragColumns ?? base;
    const taskId = String(active.id);
    const to = columnOf(over?.id, cols);
    if (!to) return reset();

    const items = cols[to];
    const fromIndex = items.indexOf(taskId);
    const overIndex = over ? items.indexOf(String(over.id)) : -1;
    // Same semantics as arrayMove: the card lands where the hovered card was.
    const toIndex = overIndex >= 0 ? overIndex : fromIndex >= 0 ? fromIndex : items.length;

    const original = tasks[taskId];
    const originalIndex = base[original.statusId]?.indexOf(taskId);
    const changed = original.statusId !== to || originalIndex !== toIndex;
    // Store call happens synchronously before the local override is dropped → no flicker.
    if (changed) void moveTask({ taskId, toStatusId: to, toIndex });
    reset();
  };

  const statusById = useMemo(() => Object.fromEntries(board.statuses.map((s) => [s.id, s])), [board.statuses]);
  const cardProps = (task: Task) => ({
    task,
    assignees: task.assigneeIds.map((id) => users[id]).filter(Boolean),
    done: statusById[task.statusId]?.category === 'done',
    progress: board.subtaskProgress[task.id],
    pending: !!pending[task.id],
  });
  const activeTask = activeId ? tasks[activeId] : undefined;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={reset}
    >
      <div className="flex h-full items-start gap-3 overflow-x-auto px-6 pb-6 pt-4" data-testid="board">
        {board.statuses.map((status) => (
          <Column
            key={status.id}
            status={status}
            listId={board.list.id}
            taskIds={columns[status.id] ?? []}
            highlighted={!!activeId && overColumn === status.id}
            dragging={!!activeId}
            render={(id) => {
              const task = tasks[id];
              return task ? <SortableTaskCard key={id} {...cardProps(task)} onOpen={() => onOpenTask(id)} /> : null;
            }}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' }}>
        {activeTask && <TaskCardBody {...cardProps(activeTask)} overlay className="w-[17rem]" />}
      </DragOverlay>
    </DndContext>
  );
}

function Column({
  status,
  listId,
  taskIds,
  highlighted,
  dragging,
  render,
}: {
  status: Status;
  listId: ID;
  taskIds: ID[];
  highlighted: boolean;
  dragging: boolean;
  render: (id: ID) => ReactNode;
}) {
  const { setNodeRef } = useDroppable({ id: status.id, data: { type: 'column' } });
  const styles = STATUS_STYLES[status.color];
  const [adding, setAdding] = useState(0);

  return (
    <section
      aria-label={`${status.name} column`}
      data-testid={`column-${status.name}`}
      className={cn(
        'flex max-h-full w-72 shrink-0 flex-col rounded-panel bg-surface-muted ring-1 ring-inset ring-line transition-colors duration-150',
        highlighted && 'bg-brand-50/70 ring-2 ring-brand-300',
      )}
    >
      <header className="flex items-center gap-2 px-3 pb-2 pt-3">
        <span className={cn('h-2 w-2 rounded-full', styles.dot)} aria-hidden />
        <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{status.name}</h3>
        <span className="rounded-full bg-surface px-1.5 text-2xs font-semibold tabular-nums text-ink-subtle ring-1 ring-inset ring-line">
          {taskIds.length}
        </span>
        <button
          type="button"
          aria-label={`Add task to ${status.name}`}
          onClick={() => setAdding((n) => n + 1)}
          className="ml-auto flex h-6 w-6 items-center justify-center rounded text-ink-subtle hover:bg-surface-sunken hover:text-ink"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </header>

      <div ref={setNodeRef} className="flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {taskIds.map(render)}
        </SortableContext>
        {taskIds.length === 0 && (
          <div
            className={cn(
              'flex flex-1 flex-col items-center justify-center gap-1.5 rounded-card border border-dashed px-3 py-6 text-center transition-colors',
              highlighted ? 'border-brand-300 text-brand-600' : 'border-line-strong text-ink-faint',
            )}
          >
            {highlighted ? (
              <StatusIcon category={status.category} className="h-5 w-5" />
            ) : (
              <Inbox className="h-5 w-5" aria-hidden />
            )}
            <p className="text-xs font-medium">
              {highlighted ? `Drop to move to ${status.name}` : dragging ? 'Drop here' : `No tasks in ${status.name}`}
            </p>
          </div>
        )}
      </div>
      <div className="px-2 pb-2">
        <QuickAdd key={adding} listId={listId} statusId={status.id} compact autoOpen={adding > 0} />
      </div>
    </section>
  );
}
