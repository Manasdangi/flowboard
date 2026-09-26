import { Archive, ClipboardList, KanbanSquare, List as ListIcon, Lock, Plus, Settings2, Share2 } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { selectBoard } from '@/domain/selectors';
import { selectVisibleLists } from '@/domain/tree';
import { cn } from '@/lib/cn';
import { useRoute, type ViewMode } from '@/lib/router';
import { useActions, useAppStore, useCurrentUser, useData, useIsAdmin } from '@/store/hooks';
import { uiStore } from '@/store/ui';
import { FOCUS_RING } from '@/ui/tokens';
import { BoardView } from './board/BoardView';
import { ListView } from './list/ListView';
import { Button } from './ui/Button';
import { EmptyState } from './ui/EmptyState';
import { BoardSkeleton, ListSkeleton, Skeleton } from './ui/Skeleton';

export function ListScreen() {
  const data = useData();
  const user = useCurrentUser();
  const isAdmin = useIsAdmin();
  const boot = useAppStore((s) => s.boot);
  const loadingListId = useAppStore((s) => s.loadingListId);
  const { openList, createTask } = useActions();
  const [route, navigate] = useRoute();
  const { listId, view } = route;

  const visibleLists = useMemo(() => selectVisibleLists(data, user.id), [data, user.id]);
  const firstList = visibleLists[0];

  // No list in the URL → land on the first list this user can see.
  useEffect(() => {
    if (boot === 'ready' && !listId && firstList) navigate({ listId: firstList.id }, { replace: true });
  }, [boot, listId, firstList, navigate]);

  // Simulated fetch whenever the selected list changes (skeleton state).
  useEffect(() => {
    if (boot === 'ready' && listId) void openList(listId);
  }, [boot, listId, openList]);

  // Permission check lives in the selector: switching users re-runs this immediately.
  const board = useMemo(() => (listId ? selectBoard(data, user.id, listId) : null), [data, user.id, listId]);

  if (boot === 'loading' || (listId && loadingListId === listId)) {
    return (
      <div className="flex h-full flex-col">
        <HeaderSkeleton />
        {view === 'list' ? <ListSkeleton /> : <BoardSkeleton />}
      </div>
    );
  }

  if (!listId || !board) {
    return (
      <EmptyState icon={<ClipboardList className="h-6 w-6" />} title="No lists yet">
        {isAdmin
          ? 'Create a space, folder and list from the sidebar to get started.'
          : 'Nothing has been shared with you yet. Ask a workspace admin for access.'}
      </EmptyState>
    );
  }

  if (board.error) {
    const forbidden = board.error.code === 'FORBIDDEN';
    return (
      <EmptyState
        tone="danger"
        icon={forbidden ? <Lock className="h-6 w-6" /> : <Archive className="h-6 w-6" />}
        title={forbidden ? '403 · No access to this list' : 'List unavailable'}
        action={
          firstList && (
            <Button variant="primary" onClick={() => navigate({ listId: firstList.id, taskId: null })}>
              Go to {firstList.name}
            </Button>
          )
        }
      >
        <p>{board.error.message}</p>
        {forbidden && (
          <p className="mt-2 text-xs text-ink-subtle">
            Signed in as <span className="font-semibold text-ink-muted">{user.name}</span> ({user.role}). Switch user
            from the top bar to compare.
          </p>
        )}
      </EmptyState>
    );
  }

  const { list, taskCount } = board.data;
  const openTask = (taskId: string) => navigate({ taskId });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-end gap-4 px-6 pt-5">
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 truncate text-xl font-semibold tracking-tight text-ink">
            {list.name}
            {list.visibility === 'private' && (
              <span className="inline-flex items-center gap-1 rounded-full bg-surface-sunken px-2 py-0.5 text-2xs font-semibold uppercase tracking-wide text-ink-muted">
                <Lock className="h-3 w-3" /> Private
              </span>
            )}
          </h1>
          <p className="mt-0.5 text-xs text-ink-subtle">
            {taskCount} task{taskCount === 1 ? '' : 's'} · {board.data.statuses.length} statuses
          </p>
        </div>
        <ViewTabs view={view} onChange={(v) => navigate({ view: v })} />
        {isAdmin && (
          <>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => uiStore.getState().openDialog({ kind: 'statuses', listId: list.id })}
            >
              <Settings2 className="h-3.5 w-3.5" /> Statuses
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => uiStore.getState().openDialog({ kind: 'share', containerId: list.id })}
            >
              <Share2 className="h-3.5 w-3.5" /> Share
            </Button>
          </>
        )}
        <Button
          size="sm"
          variant="primary"
          onClick={() => {
            const result = createTask({ listId: list.id, title: 'Untitled task' });
            if (result.data) {
              uiStore.getState().setDraftTaskId(result.data.id);
              openTask(result.data.id);
            }
          }}
        >
          <Plus className="h-3.5 w-3.5" /> New task
        </Button>
      </div>

      <div className="min-h-0 flex-1">
        {taskCount === 0 && view === 'list' ? (
          <EmptyState
            icon={<ClipboardList className="h-6 w-6" />}
            title={`${list.name} is empty`}
            action={
              <Button variant="primary" onClick={() => navigate({ view: 'board' })}>
                Open board to add tasks
              </Button>
            }
          >
            Tasks you add to this list will show up here, sortable by due date and priority.
          </EmptyState>
        ) : view === 'list' ? (
          <ListView key={list.id} listId={list.id} onOpenTask={openTask} />
        ) : (
          <div className="flex h-full flex-col">
            {taskCount === 0 && (
              <p className="mx-6 mt-4 rounded-card bg-brand-50 px-3 py-2 text-xs text-brand-800 ring-1 ring-inset ring-brand-100">
                This list is empty — use <span className="font-semibold">Add task</span> in any column, or{' '}
                <span className="font-semibold">New task</span> above.
              </p>
            )}
            <div className="min-h-0 flex-1">
              <BoardView board={board.data} onOpenTask={openTask} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ViewTabs({ view, onChange }: { view: ViewMode; onChange: (v: ViewMode) => void }) {
  const tabs: { id: ViewMode; label: string; icon: typeof KanbanSquare }[] = [
    { id: 'board', label: 'Board', icon: KanbanSquare },
    { id: 'list', label: 'List', icon: ListIcon },
  ];
  return (
    <div role="tablist" aria-label="View" className="flex rounded-control bg-surface-sunken p-0.5">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={view === t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            'flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors',
            FOCUS_RING,
            view === t.id ? 'bg-surface text-ink shadow-card' : 'text-ink-muted hover:text-ink',
          )}
        >
          <t.icon className="h-3.5 w-3.5" /> {t.label}
        </button>
      ))}
    </div>
  );
}

function HeaderSkeleton() {
  return (
    <div className="flex items-end gap-4 px-6 pt-5">
      <div className="flex-1 space-y-2">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-3 w-28" />
      </div>
      <Skeleton className="h-8 w-36" />
      <Skeleton className="h-8 w-24" />
    </div>
  );
}
