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
import { GripVertical } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import type { TreeNode } from '@/domain/tree';
import type { Container, ID } from '@/domain/types';
import { cn } from '@/lib/cn';
import { FOCUS_RING } from '@/ui/tokens';
import { INDENT, TreeRow, TypeIcon } from './TreeRow';

/**
 * What the tree can do, supplied by the connected `Sidebar`. The tree itself
 * never reads the store, so it renders from props alone.
 */
export interface TreeActions {
  /** Drag to reorder, F2 / double-click to rename, and the "+" button. */
  canEdit: boolean;
  onSelectList: (listId: ID) => void;
  onRename: (id: ID, name: string) => void;
  onReorder: (id: ID, toIndex: number) => void;
  onAddChild: (parentId: ID) => void;
  /** The row's "…" menu; `startRename` opens the inline rename field. */
  renderMenu: (container: Container, startRename: () => void) => ReactNode;
}

interface TreeProps {
  nodes: TreeNode[];
  /** Accessible name of the tree, e.g. "Workspace" or "Shared with me". */
  label: string;
  selectedListId: ID | null;
  taskCounts: Record<ID, number>;
  actions: TreeActions;
}

function findNode(nodes: TreeNode[], id: ID): TreeNode | undefined {
  for (const n of nodes) {
    if (n.container.id === id) return n;
    const hit = findNode(n.children, id);
    if (hit) return hit;
  }
  return undefined;
}

export function SidebarTree(props: TreeProps) {
  const { nodes, actions } = props;
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
    actions.onReorder(String(active.id), siblings.indexOf(String(over.id)));
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
      <Branch {...props} depth={0} parentId="root" collapsed={collapsed} onToggle={toggle} />
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

interface BranchProps extends TreeProps {
  depth: number;
  parentId: ID;
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
  const { actions } = props;
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: container.id,
    data: { parentId: props.parentId, siblings },
    disabled: !actions.canEdit,
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
      <TreeRow
        node={node}
        depth={props.depth}
        open={open}
        selected={selected}
        canEdit={actions.canEdit}
        count={props.taskCounts[container.id]}
        onToggle={() => props.onToggle(container.id)}
        onSelect={() => (isList ? actions.onSelectList(container.id) : props.onToggle(container.id))}
        onRename={(name) => actions.onRename(container.id, name)}
        onAddChild={() => actions.onAddChild(container.id)}
        renderMenu={actions.renderMenu}
        dragHandle={
          actions.canEdit ? (
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
