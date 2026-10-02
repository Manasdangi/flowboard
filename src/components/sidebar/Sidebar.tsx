import { Eye, Plus, Search } from 'lucide-react';
import { useMemo } from 'react';
import { selectArchived, selectSharedWithMe, selectVisibleTree } from '@/domain/tree';
import type { ID } from '@/domain/types';
import { cn } from '@/lib/cn';
import { useRoute } from '@/lib/router';
import { useActions, useAppStore, useCurrentUser, useDataWith, useIsAdmin, useTaskCounts } from '@/store/hooks';
import { uiStore } from '@/store/ui';
import { FOCUS_RING } from '@/ui/tokens';
import { Kbd } from '../ui/Kbd';
import { TreeSkeleton } from '../ui/Skeleton';
import { ArchivedSection } from './ArchivedSection';
import { ContainerMenu } from './ContainerMenu';
import { SidebarTree, type TreeActions } from './SidebarTree';
import { WorkspaceName } from './WorkspaceName';

/**
 * The connected part of the sidebar: it reads the store and passes data and
 * callbacks down. Everything it renders (tree, rows, header, archive) is props-only.
 */
export function Sidebar() {
  const data = useDataWith();
  const user = useCurrentUser();
  const isAdmin = useIsAdmin();
  const boot = useAppStore((s) => s.boot);
  const [route, navigate] = useRoute();
  const { renameContainer, reorderContainer, restoreContainer } = useActions();

  // Permission filtering happens in the selector, not here.
  const tree = useMemo(() => selectVisibleTree(data, user.id), [data, user.id]);
  const shared = useMemo(() => selectSharedWithMe(data, user.id), [data, user.id]);
  const archived = useMemo(() => selectArchived(data), [data]);
  const taskCounts = useTaskCounts();
  const workspace = data.containers[data.workspaceId];

  const openCreate = (parentId: ID) => uiStore.getState().openDialog({ kind: 'create', parentId });
  const treeActions: TreeActions = {
    canEdit: isAdmin,
    onSelectList: (listId) => navigate({ listId, taskId: null }),
    onRename: renameContainer,
    onReorder: reorderContainer,
    onAddChild: openCreate,
    renderMenu: (container, startRename) => (
      <ContainerMenu container={container} isAdmin={isAdmin} onRename={startRename} />
    ),
  };

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
          {workspace && (
            <WorkspaceName
              workspace={workspace}
              canEdit={isAdmin}
              onRename={(name) => renameContainer(workspace.id, name)}
            />
          )}
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
              onClick={() => openCreate(data.workspaceId)}
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
              actions={treeActions}
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
                  actions={treeActions}
                />
              </div>
            )}
          </>
        )}
      </nav>

      {isAdmin && boot === 'ready' && <ArchivedSection archived={archived} onRestore={restoreContainer} />}
    </aside>
  );
}
