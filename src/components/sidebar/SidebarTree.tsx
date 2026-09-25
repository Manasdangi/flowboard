import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronRight, Folder, FolderOpen, GripVertical, ListTodo, Lock, Plus } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { CHILD_TYPE, type TreeNode } from '@/domain/tree';
import type { Container, ID } from '@/domain/types';
import { cn } from '@/lib/cn';
import { useActions, useIsAdmin } from '@/store/hooks';
import { uiStore } from '@/store/ui';
import { FOCUS_RING } from '@/ui/tokens';
import { ContainerMenu } from './ContainerMenu';

const INDENT = ['pl-1.5', 'pl-5', 'pl-9', 'pl-[3.25rem]'];

interface TreeProps {
  nodes: TreeNode[];
  /** Accessible name of the tree, e.g. "Workspace" or "Shared with me". */
  label: string;
  selectedListId: ID | null;
  taskCounts: Record<ID, number>;
  onSelectList: (listId: ID) => void;
}

function findNode(nodes: TreeNode[], id: ID): TreeNode | undefined {
  for (const n of nodes) {
    if (n.container.id === id) return n;
    const hit = findNode(n.children, id);
    if (hit) return hit;
  }
  return undefined;
}

export function SidebarTree({ nodes, label, selectedListId, taskCounts, onSelectList }: TreeProps) {
  const isAdmin = useIsAdmin();
  const { reorderContainer } = useActions();
  const [collapsed, setCollapsed] = useState<Set<ID>>(() => new Set());
  const [activeId, setActiveId] = useState<ID | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Everything starts expanded; collapse state is local UI state.
  const toggle = (id: ID) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    if (!over || active.id === over.id) return;
    // Only siblings can be reordered — dropping onto another group is ignored.
    if (active.data.current?.parentId !== over.data.current?.parentId) return;
    const siblings: ID[] = over.data.current?.siblings ?? [];
    reorderContainer(String(active.id), siblings.indexOf(String(over.id)));
  };

  const active = activeId ? findNode(nodes, activeId) : undefined;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <Branch
        nodes={nodes}
        label={label}
        depth={0}
        parentId="root"
        isAdmin={isAdmin}
        collapsed={collapsed}
        onToggle={toggle}
        selectedListId={selectedListId}
        taskCounts={taskCounts}
        onSelectList={onSelectList}
      />
      <DragOverlay dropAnimation={null}>
        {active && (
          <div className="flex h-8 items-center gap-2 rounded-control bg-surface px-2 text-sm font-medium text-ink shadow-drag">
            <TypeIcon container={active.container} open={false} />
            {active.container.name}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

interface BranchProps extends Omit<TreeProps, 'nodes'> {
  nodes: TreeNode[];
  depth: number;
  parentId: ID;
  isAdmin: boolean;
  collapsed: Set<ID>;
  onToggle: (id: ID) => void;
}

function Branch(props: BranchProps) {
  const ids = props.nodes.map((n) => n.container.id);
  return (
    <SortableContext items={ids} strategy={verticalListSortingStrategy}>
      <ul
        role={props.depth === 0 ? 'tree' : 'group'}
        aria-label={props.depth === 0 ? props.label : undefined}
        className="space-y-px"
      >
        {props.nodes.map((node) => (
          <SortableItem key={node.container.id} node={node} siblings={ids} {...props} />
        ))}
      </ul>
    </SortableContext>
  );
}

function SortableItem({ node, siblings, ...props }: BranchProps & { node: TreeNode; siblings: ID[] }) {
  const { container, children } = node;
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: container.id,
    data: { parentId: props.parentId, siblings },
    disabled: !props.isAdmin,
  });
  const isList = container.type === 'list';
  const open = !props.collapsed.has(container.id);
  const selected = isList && props.selectedListId === container.id;

  return (
    <li
      ref={setNodeRef}
      role="treeitem"
      aria-expanded={isList ? undefined : open}
      aria-selected={selected}
      // dnd-kit needs an inline transform for the moving row (documented exception).
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(isDragging && 'relative z-10 opacity-40')}
    >
      <Row
        node={node}
        depth={props.depth}
        open={open}
        selected={selected}
        isAdmin={props.isAdmin}
        count={props.taskCounts[container.id]}
        onToggle={() => props.onToggle(container.id)}
        onSelect={() => (isList ? props.onSelectList(container.id) : props.onToggle(container.id))}
        dragHandle={
          props.isAdmin ? (
            <button
              ref={setActivatorNodeRef}
              type="button"
              aria-label={`Reorder ${container.name}`}
              className={cn(
                'absolute -left-0.5 flex h-6 w-3.5 cursor-grab items-center justify-center rounded text-ink-faint opacity-0 transition-opacity hover:text-ink-muted focus-visible:opacity-100 active:cursor-grabbing group-hover:opacity-100',
                FOCUS_RING,
              )}
              {...attributes}
              {...listeners}
            >
              <GripVertical className="h-3 w-3" />
            </button>
          ) : null
        }
      />
      {!isList && open && children.length > 0 && (
        <Branch {...props} nodes={children} depth={props.depth + 1} parentId={container.id} />
      )}
      {!isList && open && children.length === 0 && (
        <p className={cn('py-1 text-xs italic text-ink-faint', INDENT[props.depth + 1], 'ml-6')}>
          {container.type === 'space' ? 'No folders yet' : 'No lists yet'}
        </p>
      )}
    </li>
  );
}

function TypeIcon({ container, open }: { container: Container; open: boolean }) {
  if (container.type === 'space') {
    return (
      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-brand-600 text-[9px] font-bold uppercase text-white">
        {container.name[0]}
      </span>
    );
  }
  if (container.type === 'folder') {
    const Icon = open ? FolderOpen : Folder;
    return <Icon className="h-4 w-4 shrink-0 text-ink-subtle" aria-hidden />;
  }
  return <ListTodo className="h-4 w-4 shrink-0 text-ink-subtle" aria-hidden />;
}

function Row({
  node,
  depth,
  open,
  selected,
  isAdmin,
  count,
  onToggle,
  onSelect,
  dragHandle,
}: {
  node: TreeNode;
  depth: number;
  open: boolean;
  selected: boolean;
  isAdmin: boolean;
  count?: number;
  onToggle: () => void;
  onSelect: () => void;
  dragHandle: ReactNode;
}) {
  const { container } = node;
  const { renameContainer } = useActions();
  const [editing, setEditing] = useState(false);
  const isList = container.type === 'list';
  const canAddChild = CHILD_TYPE[container.type] !== null;

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight' && !isList && !open) onToggle();
    if (e.key === 'ArrowLeft' && !isList && open) onToggle();
    if (e.key === 'F2' && isAdmin) setEditing(true);
  };

  return (
    <div
      className={cn(
        'group relative flex h-8 items-center gap-1.5 rounded-control pr-1 text-sm transition-colors',
        INDENT[depth],
        selected ? 'bg-brand-50 text-brand-800' : 'text-ink-muted hover:bg-surface-sunken hover:text-ink',
      )}
    >
      {dragHandle}
      {!isList ? (
        <button
          type="button"
          onClick={onToggle}
          aria-label={open ? `Collapse ${container.name}` : `Expand ${container.name}`}
          className={cn(
            'flex h-5 w-5 shrink-0 items-center justify-center rounded text-ink-faint hover:bg-line hover:text-ink-muted',
            FOCUS_RING,
          )}
        >
          <ChevronRight className={cn('h-3.5 w-3.5 transition-transform duration-150', open && 'rotate-90')} />
        </button>
      ) : (
        <span className="w-5 shrink-0" />
      )}

      {editing ? (
        <RenameInput
          initial={container.name}
          onDone={(name) => {
            setEditing(false);
            if (name !== null && name !== container.name) renameContainer(container.id, name);
          }}
        />
      ) : (
        <button
          type="button"
          onClick={onSelect}
          onKeyDown={onKeyDown}
          onDoubleClick={() => isAdmin && setEditing(true)}
          aria-current={selected ? 'page' : undefined}
          title={container.name}
          className={cn(
            'flex min-w-0 flex-1 items-center gap-2 rounded py-1 text-left',
            FOCUS_RING,
            (container.type === 'space' || selected) && 'font-medium',
            container.type === 'space' && !selected && 'text-ink',
          )}
        >
          <TypeIcon container={container} open={open} />
          <span className="truncate">{container.name}</span>
          {container.visibility === 'private' && (
            <Lock className="h-3 w-3 shrink-0 text-ink-faint" aria-label="Private" />
          )}
        </button>
      )}

      {!editing && (
        <div className="flex shrink-0 items-center">
          {isList && count !== undefined && (
            <span
              className={cn(
                'px-1 text-2xs tabular-nums text-ink-faint group-focus-within:hidden group-hover:hidden',
                selected && 'text-brand-500',
              )}
            >
              {count}
            </span>
          )}
          <div className="hidden items-center group-focus-within:flex group-hover:flex has-[[data-open]]:flex">
            <ContainerMenu container={container} isAdmin={isAdmin} onRename={() => setEditing(true)} />
            {canAddChild && isAdmin && (
              <button
                type="button"
                aria-label={`Add ${CHILD_TYPE[container.type]} to ${container.name}`}
                title={`New ${CHILD_TYPE[container.type]}`}
                onClick={() => uiStore.getState().openDialog({ kind: 'create', parentId: container.id })}
                className={cn(
                  'flex h-6 w-6 items-center justify-center rounded text-ink-subtle hover:bg-line hover:text-ink',
                  FOCUS_RING,
                )}
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Inline rename field: Enter or blur saves, Escape cancels (`onDone(null)`). */
export function RenameInput({ initial, onDone }: { initial: string; onDone: (name: string | null) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(initial);
  const done = useRef(false);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  const finish = (name: string | null) => {
    if (done.current) return;
    done.current = true;
    onDone(name);
  };
  return (
    <input
      ref={ref}
      value={value}
      aria-label="Rename"
      maxLength={80}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => finish(value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') finish(value);
        if (e.key === 'Escape') finish(null);
      }}
      className="h-6 min-w-0 flex-1 rounded bg-surface px-1.5 text-sm text-ink ring-2 ring-brand-500 focus:outline-none"
    />
  );
}
