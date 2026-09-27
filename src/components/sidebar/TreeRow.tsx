import { ChevronRight, Folder, FolderOpen, ListTodo, Lock, Plus } from 'lucide-react';
import { useState, type KeyboardEvent, type ReactNode } from 'react';
import { CHILD_TYPE, type TreeNode } from '@/domain/tree';
import type { Container } from '@/domain/types';
import { cn } from '@/lib/cn';
import { FOCUS_RING } from '@/ui/tokens';
import { RenameInput } from '../ui/RenameInput';

export const INDENT = ['pl-1.5', 'pl-5', 'pl-9', 'pl-[3.25rem]'];

export function TypeIcon({ container, open }: { container: Container; open: boolean }) {
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

/** One sidebar row. Props only: everything it can do arrives as a callback. */
export function TreeRow({
  node,
  depth,
  open,
  selected,
  canEdit,
  count,
  dragHandle,
  onToggle,
  onSelect,
  onRename,
  onAddChild,
  renderMenu,
}: {
  node: TreeNode;
  depth: number;
  open: boolean;
  selected: boolean;
  canEdit: boolean;
  count?: number;
  dragHandle: ReactNode;
  onToggle: () => void;
  onSelect: () => void;
  onRename: (name: string) => void;
  onAddChild: () => void;
  renderMenu: (container: Container, startRename: () => void) => ReactNode;
}) {
  const { container } = node;
  const [editing, setEditing] = useState(false);
  const isList = container.type === 'list';
  const canAddChild = CHILD_TYPE[container.type] !== null;

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight' && !isList && !open) onToggle();
    if (e.key === 'ArrowLeft' && !isList && open) onToggle();
    if (e.key === 'F2' && canEdit) setEditing(true);
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
            if (name !== null && name !== container.name) onRename(name);
          }}
        />
      ) : (
        <button
          type="button"
          onClick={onSelect}
          onKeyDown={onKeyDown}
          onDoubleClick={() => canEdit && setEditing(true)}
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
            {renderMenu(container, () => setEditing(true))}
            {canAddChild && canEdit && (
              <button
                type="button"
                aria-label={`Add ${CHILD_TYPE[container.type]} to ${container.name}`}
                title={`New ${CHILD_TYPE[container.type]}`}
                onClick={onAddChild}
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
