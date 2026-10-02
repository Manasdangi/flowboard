import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import { ArrowUpRight, ChevronRight, Flag, FolderInput, Lock, Pencil, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { selectTaskDetail, type TaskDetail } from '@/domain/selectors';
import { PRIORITIES, TITLE_MAX } from '@/domain/tasks';
import type { ID, Priority } from '@/domain/types';
import { cn } from '@/lib/cn';
import { formatRelative, fromDateInput, toDateInput } from '@/lib/dates';
import { useRoute } from '@/lib/router';
import { useActions, useAppStore, useDataWith } from '@/store/hooks';
import { notify } from '@/store/toasts';
import { uiStore } from '@/store/ui';
import { PRIORITY_STYLES, STATUS_STYLES } from '@/ui/tokens';
import { Button, IconButton } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { Select, TextArea } from '../ui/Field';
import { StatusIcon } from '../ui/Badges';
import { ActivitySection } from './ActivitySection';
import { AssigneePicker } from './AssigneePicker';
import { AttachmentsSection } from './AttachmentsSection';
import { SubtaskList } from './SubtaskList';

/**
 * Right-hand drawer driven by ?task=<id>. Headless UI's Dialog gives us
 * Escape / overlay-click to close, a focus trap, and focus restoration.
 */
export function TaskDrawer() {
  const [route, navigate] = useRoute();
  const taskId = route.taskId;
  const { discardUntouchedDraft } = useActions();

  const close = () => {
    const { draftTaskId, setDraftTaskId } = uiStore.getState();
    if (draftTaskId) {
      setDraftTaskId(null);
      discardUntouchedDraft(draftTaskId);
    }
    navigate({ taskId: null });
  };

  return (
    <Dialog open={!!taskId} onClose={close} className="relative z-40">
      <DialogBackdrop className="fixed inset-0 animate-fade-in bg-ink/20" />
      <div className="fixed inset-y-0 right-0 flex max-w-full">
        <DialogPanel
          data-testid="task-drawer"
          className="flex h-full w-[34rem] max-w-[100vw] animate-slide-in-right flex-col bg-surface shadow-drawer"
        >
          {/* Mounted only while a task is open, so a closed drawer doesn't subscribe to the data. */}
          {taskId && <DrawerBody taskId={taskId} onClose={close} onOpenTask={(id) => navigate({ taskId: id })} />}
        </DialogPanel>
      </div>
    </Dialog>
  );
}

/** Loads one task's detail (permission-checked) and shows it, or the 403 / not-found state. */
function DrawerBody({
  taskId,
  onClose,
  onOpenTask,
}: {
  taskId: ID;
  onClose: () => void;
  onOpenTask: (id: ID) => void;
}) {
  const data = useDataWith('tasks', 'statuses', 'comments', 'activity', 'attachments');
  const userId = useAppStore((s) => s.currentUserId);
  const detail = useMemo(() => selectTaskDetail(data, userId, taskId), [data, userId, taskId]);

  if (detail.error) {
    return (
      <>
        <DialogTitle className="sr-only">Task unavailable</DialogTitle>
        <div className="flex justify-end p-3">
          <IconButton label="Close" onClick={onClose}>
            <X className="h-4 w-4" />
          </IconButton>
        </div>
        <EmptyState
          tone="danger"
          icon={<Lock className="h-6 w-6" />}
          title={detail.error.code === 'FORBIDDEN' ? '403 · You can’t open this task' : 'Task not found'}
          action={<Button onClick={onClose}>Close</Button>}
        >
          {detail.error.message}
        </EmptyState>
      </>
    );
  }
  return <DrawerContent key={detail.data.task.id} detail={detail.data} onClose={onClose} onOpenTask={onOpenTask} />;
}

function DrawerContent({
  detail,
  onClose,
  onOpenTask,
}: {
  detail: TaskDetail;
  onClose: () => void;
  onOpenTask: (id: ID) => void;
}) {
  const { task, statuses, path, parent, assignableUsers, movableLists } = detail;
  const {
    createTask,
    updateTask,
    moveTask,
    deleteTask,
    addComment,
    addAttachment,
    removeAttachment,
    getAttachmentBlob,
  } = useActions();
  const [, navigate] = useRoute();
  const users = useAppStore((s) => s.data.users);
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const creator = users[task.createdBy];

  // External updates (another view, rollback) flow into the local drafts.
  useEffect(() => setTitle(task.title), [task.title]);
  useEffect(() => setDescription(task.description), [task.description]);

  const commitTitle = () => {
    if (title === task.title) return;
    if (updateTask(task.id, { title }).error) setTitle(task.title);
  };
  const commitDescription = () => description !== task.description && updateTask(task.id, { description });

  const moveToList = async (listId: ID) => {
    const target = movableLists.find((l) => l.id === listId);
    const result = await moveTask({ taskId: task.id, toListId: listId });
    if (!result.error) {
      notify.success(`Moved to ${target?.name}`);
      navigate({ listId, taskId: task.id });
    }
  };

  const loadBlob = useCallback(async (id: ID) => (await getAttachmentBlob(id)).data ?? null, [getAttachmentBlob]);
  const addFiles = async (files: File[]) => {
    for (const file of files) await addAttachment(task.id, file); // one at a time; each failure shows its own toast
  };

  const remove = () => {
    const result = deleteTask(task.id);
    if (!result.error) {
      notify.success(
        'Task deleted',
        result.data.length > 1 ? `Along with ${result.data.length - 1} subtask(s).` : undefined,
      );
      onClose();
    }
  };

  const status = statuses.find((s) => s.id === task.statusId);
  const statusStyles = status ? STATUS_STYLES[status.color] : undefined;

  return (
    <>
      <div className="flex h-12 shrink-0 items-center gap-1 border-b border-line px-4">
        <nav aria-label="Task location" className="flex min-w-0 flex-1 items-center gap-1 text-xs text-ink-subtle">
          {path.map((c, i) => (
            <span key={c.id} className="flex min-w-0 items-center gap-1">
              {i > 0 && <ChevronRight className="h-3 w-3 shrink-0 text-ink-faint" />}
              <span className={cn('truncate', i === path.length - 1 && 'font-medium text-ink-muted')}>{c.name}</span>
            </span>
          ))}
        </nav>
        {confirmDelete ? (
          <div className="flex animate-fade-in items-center gap-1.5">
            <span className="text-xs font-medium text-rose-700">Delete task?</span>
            <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button size="sm" variant="danger" onClick={remove} autoFocus>
              Delete
            </Button>
          </div>
        ) : (
          <IconButton
            label="Delete task"
            onClick={() => setConfirmDelete(true)}
            className="hover:bg-rose-50 hover:text-rose-600"
          >
            <Trash2 className="h-4 w-4" />
          </IconButton>
        )}
        <IconButton label="Close (Esc)" onClick={onClose}>
          <X className="h-4 w-4" />
        </IconButton>
      </div>

      {/* The styled scrollbar stays visible (macOS hides the default one), so it's clear the drawer scrolls. */}
      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-8 pt-5 [&::-webkit-scrollbar-thumb:hover]:bg-ink-faint [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-line-strong [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:w-2">
        {parent && (
          <button
            type="button"
            onClick={() => onOpenTask(parent.id)}
            className="mb-2 inline-flex max-w-full items-center gap-1 rounded px-1 py-0.5 text-xs font-medium text-brand-700 hover:bg-brand-50"
          >
            <ArrowUpRight className="h-3 w-3" /> <span className="truncate">Subtask of {parent.title}</span>
          </button>
        )}
        <div className="flex items-start gap-2">
          <AssigneePicker
            assigneeIds={task.assigneeIds}
            candidates={assignableUsers}
            users={users}
            onChange={(assigneeIds) => updateTask(task.id, { assigneeIds })}
          />
          {/* Auto-growing title without JS sizing: an invisible mirror shares the grid cell. */}
          <DialogTitle as="div" className="-ml-1 -mr-2 grid min-w-0 flex-1">
            <div aria-hidden className={cn(TITLE_CLASSES, 'invisible whitespace-pre-wrap break-words')}>
              {title + ' '}
            </div>
            <textarea
              ref={titleRef}
              data-autofocus
              aria-label="Task title"
              rows={1}
              value={title}
              maxLength={TITLE_MAX}
              onFocus={(e) => task.title === 'Untitled task' && e.currentTarget.select()}
              onChange={(e) => setTitle(e.target.value.replace(/\n/g, ''))}
              onBlur={commitTitle}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  e.currentTarget.blur();
                }
              }}
              className={cn(
                TITLE_CLASSES,
                'resize-none overflow-hidden bg-transparent text-ink transition-colors hover:bg-surface-muted focus:bg-surface-muted focus:outline-none focus:ring-2 focus:ring-brand-500',
              )}
            />
          </DialogTitle>
          <IconButton
            label="Edit title"
            onClick={() => {
              titleRef.current?.focus();
              titleRef.current?.select();
            }}
            className="mt-1 h-8 w-8"
          >
            <Pencil className="h-4 w-4" />
          </IconButton>
        </div>
        {title.length > TITLE_MAX - 100 && (
          <p
            className={cn(
              'mt-1 text-right text-2xs tabular-nums',
              title.length >= TITLE_MAX ? 'text-rose-600' : 'text-ink-subtle',
            )}
          >
            {title.length}/{TITLE_MAX}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Select
            aria-label="Status"
            value={task.statusId}
            className="w-40 font-medium"
            leading={status && <StatusIcon category={status.category} className={statusStyles?.text} />}
            onChange={(e) => updateTask(task.id, { statusId: e.target.value })}
          >
            {statuses.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Priority"
            value={task.priority}
            className="w-32"
            leading={<Flag className={cn('h-3.5 w-3.5', PRIORITY_STYLES[task.priority].icon)} />}
            onChange={(e) => updateTask(task.id, { priority: e.target.value as Priority })}
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_STYLES[p].label}
              </option>
            ))}
          </Select>
          <div className="flex items-center gap-1">
            <input
              type="date"
              aria-label="Due date"
              value={toDateInput(task.dueDate)}
              onChange={(e) => updateTask(task.id, { dueDate: fromDateInput(e.target.value) })}
              className="h-8 cursor-pointer rounded-control bg-surface px-2.5 text-sm text-ink ring-1 ring-inset ring-line-strong hover:ring-ink-faint focus:outline-none focus:ring-2 focus:ring-brand-500 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
            />
            {task.dueDate && (
              <IconButton label="Clear due date" onClick={() => updateTask(task.id, { dueDate: null })}>
                <X className="h-3.5 w-3.5" />
              </IconButton>
            )}
          </div>
        </div>

        {!task.parentTaskId && (
          <div className="mt-3 flex items-center gap-3">
            <span className="flex w-16 shrink-0 items-center gap-2 text-xs font-medium text-ink-subtle">
              <FolderInput className="h-3.5 w-3.5" /> List
            </span>
            <div className="min-w-0 flex-1">
              <Select
                aria-label="Move to list"
                value={task.primaryListId}
                onChange={(e) => void moveToList(e.target.value)}
              >
                {movableLists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        )}

        <section className="mt-7">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">Description</h3>
          <TextArea
            aria-label="Description"
            rows={5}
            value={description}
            placeholder="Add more detail… (plain text)"
            onChange={(e) => setDescription(e.target.value)}
            onBlur={commitDescription}
            className="min-h-28 resize-y"
          />
          <AttachmentsSection
            items={detail.attachments}
            onAdd={addFiles}
            onRemove={(id) => removeAttachment(id)}
            loadBlob={loadBlob}
          />
        </section>

        {!task.parentTaskId && (
          <SubtaskList
            subtasks={detail.subtasks}
            statuses={statuses}
            users={users}
            onOpen={onOpenTask}
            onAddSubtask={(title) => !createTask({ listId: task.primaryListId, title, parentTaskId: task.id }).error}
            onToggleSubtask={(taskId, statusId) => updateTask(taskId, { statusId })}
          />
        )}

        <ActivitySection
          items={detail.activity}
          people={assignableUsers}
          onComment={(body) => !addComment({ taskId: task.id, body }).error}
        />

        <p className="mt-8 border-t border-line pt-4 text-2xs text-ink-subtle">
          Created by {creator?.name ?? 'someone'} · {formatRelative(task.createdAt)} &nbsp;·&nbsp; Updated{' '}
          {formatRelative(task.updatedAt)}
        </p>
      </div>
    </>
  );
}

const TITLE_CLASSES =
  'col-start-1 row-start-1 rounded-control px-2 py-1 text-xl font-semibold leading-snug tracking-tight';
