import { Archive, ChevronRight, Eye, Pencil, Plus, RotateCcw, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { selectArchived, selectSharedWithMe, selectVisibleTree } from '@/domain/tree';
import type { Container, ID } from '@/domain/types';
import { cn } from '@/lib/cn';
import { useRoute } from '@/lib/router';
import { useActions, useAppStore, useCurrentUser, useData, useIsAdmin } from '@/store/hooks';
import { uiStore } from '@/store/ui';
import { FOCUS_RING } from '@/ui/tokens';
import { Kbd } from '../ui/Kbd';
import { TreeSkeleton } from '../ui/Skeleton';
import { RenameInput, SidebarTree } from './SidebarTree';

export function Sidebar() {
  const data = useData();
  const user = useCurrentUser();
  const isAdmin = useIsAdmin();
  const boot = useAppStore((s) => s.boot);
  const [route, navigate] = useRoute();

  // Permission filtering happens in the selector, not here.
  const tree = useMemo(() => selectVisibleTree(data, user.id), [data, user.id]);
  const shared = useMemo(() => selectSharedWithMe(data, user.id), [data, user.id]);
  const onSelectList = (listId: ID) => navigate({ listId, taskId: null });
  const taskCounts = useMemo(() => {
    const counts: Record<ID, number> = {};
    for (const t of Object.values(data.tasks))
      if (!t.parentTaskId) counts[t.primaryListId] = (counts[t.primaryListId] ?? 0) + 1;
    return counts;
  }, [data.tasks]);
  const workspace = data.containers[data.workspaceId];

  return (
    <aside aria-label="Sidebar" className="flex w-64 shrink-0 flex-col border-r border-line bg-surface-muted">
      <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-line px-4">
        <span className="flex h-7 w-7 items-center justify-center rounded-control bg-brand-600 shadow-sm">
          <svg viewBox="0 0 16 16" className="h-4 w-4 text-white" aria-hidden>
            <rect x="2" y="3" width="3" height="10" rx="1" fill="currentColor" />
            <rect x="6.5" y="3" width="3" height="7" rx="1" fill="currentColor" opacity=".8" />
            <rect x="11" y="3" width="3" height="4.5" rx="1" fill="currentColor" opacity=".6" />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          {workspace && <WorkspaceName workspace={workspace} isAdmin={isAdmin} />}
          <p className="text-2xs leading-tight text-ink-subtle">Flowboard workspace</p>
        </div>
      </div>

      <div className="px-3 pt-3">
        <button
          type="button"
          onClick={() => uiStore.getState().setSearchOpen(true)}
          className={cn(
            'flex h-8 w-full items-center gap-2 rounded-control bg-surface px-2.5 text-sm text-ink-subtle shadow-card transition-colors hover:text-ink-muted',
            FOCUS_RING,
          )}
        >
          <Search className="h-3.5 w-3.5" />
          <span className="flex-1 text-left">Search tasks</span>
          <Kbd>⌘K</Kbd>
        </button>
      </div>

      {!isAdmin && (
        <div className="mx-3 mt-3 flex items-start gap-2 rounded-card bg-sky-50 px-2.5 py-2 text-xs text-sky-900 ring-1 ring-inset ring-sky-100">
          <Eye className="mt-px h-3.5 w-3.5 shrink-0 text-sky-600" />
          <span>
            Member view — you only see what’s shared with{' '}
            <span className="font-semibold">{user.name.split(' ')[0]}</span>.
          </span>
        </div>
      )}

      <nav className="mt-3 min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        <div className="flex items-center justify-between px-2 pb-1">
          <span className="text-2xs font-semibold uppercase tracking-wider text-ink-subtle">Spaces</span>
          {isAdmin && (
            <button
              type="button"
              aria-label="New space"
              title="New space"
              onClick={() => uiStore.getState().openDialog({ kind: 'create', parentId: data.workspaceId })}
              className={cn(
                'flex h-5 w-5 items-center justify-center rounded text-ink-subtle hover:bg-line hover:text-ink',
                FOCUS_RING,
              )}
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {boot === 'loading' ? (
          <TreeSkeleton />
        ) : tree.length === 0 && shared.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-ink-subtle">Nothing has been shared with you yet.</p>
        ) : (
          <>
            <SidebarTree
              nodes={tree}
              label="Workspace"
              selectedListId={route.listId}
              taskCounts={taskCounts}
              onSelectList={onSelectList}
            />
            {/* Items shared with the user inside containers they can't see; the parents stay hidden. */}
            {shared.length > 0 && (
              <div className="mt-4">
                <p className="px-2 pb-1 text-2xs font-semibold uppercase tracking-wider text-ink-subtle">
                  Shared with me
                </p>
                <SidebarTree
                  nodes={shared}
                  label="Shared with me"
                  selectedListId={route.listId}
                  taskCounts={taskCounts}
                  onSelectList={onSelectList}
                />
              </div>
            )}
          </>
        )}
      </nav>

      {isAdmin && boot === 'ready' && <ArchivedSection />}
    </aside>
  );
}

/** The workspace name in the header. Admins can rename it in place (the "U" of workspace CRUD). */
function WorkspaceName({ workspace, isAdmin }: { workspace: Container; isAdmin: boolean }) {
  const { renameContainer } = useActions();
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <RenameInput
        initial={workspace.name}
        onDone={(name) => {
          setEditing(false);
          if (name !== null && name !== workspace.name) renameContainer(workspace.id, name);
        }}
      />
    );
  }

  return (
    <div className="group flex min-w-0 items-center gap-1">
      <p className="truncate text-sm font-semibold leading-tight text-ink">{workspace.name}</p>
      {isAdmin && (
        <button
          type="button"
          aria-label="Rename workspace"
          title="Rename workspace"
          onClick={() => setEditing(true)}
          className={cn(
            'flex h-5 w-5 shrink-0 items-center justify-center rounded text-ink-faint opacity-0 transition-opacity hover:bg-line hover:text-ink focus-visible:opacity-100 group-hover:opacity-100',
            FOCUS_RING,
          )}
        >
          <Pencil className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

function ArchivedSection() {
  const data = useData();
  const { restoreContainer } = useActions();
  const [open, setOpen] = useState(false);
  const archived = useMemo(() => selectArchived(data), [data]);
  if (archived.length === 0) return null;

  return (
    <div className="shrink-0 border-t border-line px-2 py-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={cn(
          'flex h-7 w-full items-center gap-1.5 rounded-control px-2 text-xs font-medium text-ink-muted hover:bg-surface-sunken hover:text-ink',
          FOCUS_RING,
        )}
      >
        <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-90')} />
        <Archive className="h-3.5 w-3.5" />
        <span className="flex-1 text-left">Archived</span>
        <span className="tabular-nums text-ink-faint">{archived.length}</span>
      </button>
      {open && (
        <ul className="mt-1 animate-fade-in space-y-px">
          {archived.map((c) => (
            <li
              key={c.id}
              className="group flex h-7 items-center gap-2 rounded-control pl-8 pr-1 text-xs text-ink-subtle hover:bg-surface-sunken"
            >
              <span className="min-w-0 flex-1 truncate line-through decoration-ink-faint">{c.name}</span>
              <span className="text-2xs capitalize text-ink-faint group-hover:hidden">{c.type}</span>
              <button
                type="button"
                onClick={() => restoreContainer(c.id)}
                className={cn(
                  'hidden h-6 items-center gap-1 rounded px-1.5 font-medium text-brand-700 hover:bg-brand-50 focus-visible:flex group-hover:flex',
                  FOCUS_RING,
                )}
              >
                <RotateCcw className="h-3 w-3" /> Restore
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
