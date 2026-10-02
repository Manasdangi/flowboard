/**
 * The client data layer (stands in for API + DB).
 *
 *  UI ──calls──▶ actions (this file) ──▶ pure domain fns (src/domain) ──▶ Result
 *                     │                                         │
 *                     └─ on { error }: toast + return it        └─ permission guards live here
 *
 * Reads go through the permission-aware selectors in src/domain/selectors.ts.
 */
import { createStore, type StoreApi } from 'zustand/vanilla';
import { appendActivity, taskCreatedEvent, taskUpdatedEvent } from '@/domain/activity';
import * as attachments from '@/domain/attachments';
import * as comments from '@/domain/comments';
import type { AddCommentInput } from '@/domain/comments';
import * as containers from '@/domain/containers';
import type { Change, CreateContainerInput } from '@/domain/containers';
import { guardViewList } from '@/domain/permissions';
import * as sprints from '@/domain/sprints';
import type { StartSprintInput } from '@/domain/sprints';
import * as statuses from '@/domain/statuses';
import type { StatusInput } from '@/domain/statuses';
import * as tasks from '@/domain/tasks';
import type { CreateTaskInput, MoveTaskInput, TaskFields } from '@/domain/tasks';
import { createSeed } from '@/data/seed';
import { newId } from '@/domain/ids';
import type {
  ActivityEvent,
  Attachment,
  Comment,
  Container,
  DataState,
  GrantMode,
  ID,
  Result,
  Sprint,
  Status,
  StoreError,
  Task,
  Visibility,
} from '@/domain/types';
import { createMemoryBlobStore, type BlobStore } from './blobs';
import { simulateSave, sleep, type TransportSettings } from './transport';

export interface AppState {
  data: DataState;
  currentUserId: ID;
  /** First load of the workspace (drives the sidebar skeleton). */
  boot: 'loading' | 'ready';
  /** List currently being "fetched" (drives the board / list skeleton). */
  loadingListId: ID | null;
  /** Tasks with an optimistic change waiting on the fake server. */
  pendingTaskIds: Record<ID, true>;
  settings: TransportSettings;
  actions: AppActions;
}

export interface AppActions {
  bootstrap(): Promise<void>;
  switchUser(userId: ID): void;
  openList(listId: ID): Promise<Result<Container>>;
  setSettings(patch: Partial<TransportSettings>): void;
  resetDemo(): void;

  createContainer(input: CreateContainerInput): Result<Container>;
  renameContainer(id: ID, name: string): Result<Container>;
  setVisibility(id: ID, visibility: Visibility): Result<Container>;
  archiveContainer(id: ID): Result<Container>;
  restoreContainer(id: ID): Result<Container>;
  reorderContainer(id: ID, toIndex: number): Result<void>;
  setGrant(input: { resourceId: ID; userId: ID; mode: GrantMode | null }): Result<void>;

  addStatus(listId: ID, input: StatusInput): Result<Status>;
  updateStatus(statusId: ID, input: StatusInput): Result<Status>;
  deleteStatus(statusId: ID): Result<void>;

  createTask(input: CreateTaskInput): Result<Task>;
  updateTask(taskId: ID, patch: Partial<TaskFields>): Result<Task>;
  deleteTask(taskId: ID): Result<Task[]>;
  /** Deletes a "New task" draft if it was never edited; returns the removed tasks (none if kept). */
  discardUntouchedDraft(taskId: ID): Result<Task[]>;
  /** Optimistic: applied immediately, rolled back if the save fails. */
  moveTask(input: MoveTaskInput): Promise<Result<Task>>;

  addComment(input: AddCommentInput): Result<Comment>;
  /** Mark the current user's mentions as read: the given comments, or all of them. Returns how many changed. */
  markMentionsRead(commentIds?: ID[]): Result<number>;

  /** Admin only. One running sprint per list. */
  startSprint(input: StartSprintInput): Result<Sprint>;
  /** Admin only. Freezes the report (done vs spilled over). */
  endSprint(sprintId: ID): Result<Sprint>;

  /** Validates, stores the file, then commits its record. Re-checks after the wait, since the task may have changed. */
  addAttachment(taskId: ID, file: File): Promise<Result<Attachment>>;
  removeAttachment(attachmentId: ID): Result<Attachment>;
  /** The stored file, if the user can see its task. */
  getAttachmentBlob(attachmentId: ID): Promise<Result<Blob>>;
}

export interface AppStoreOptions {
  initialData?: DataState;
  currentUserId?: ID;
  settings?: Partial<TransportSettings>;
  /** Called for every failed mutation (the app shows a toast). */
  onError?: (error: StoreError) => void;
  now?: () => string;
  /** Skip the simulated first load (tests). */
  ready?: boolean;
  /** Where attachment files are kept. Defaults to memory; the app passes an IndexedDB one. */
  blobs?: BlobStore;
}

export type AppStore = StoreApi<AppState>;

export function createAppStore(opts: AppStoreOptions = {}): AppStore {
  const now = opts.now ?? (() => new Date().toISOString());
  const onError = opts.onError ?? (() => {});
  const initial = opts.initialData ?? createSeed();
  const blobs = opts.blobs ?? createMemoryBlobStore();

  return createStore<AppState>((set, get) => {
    const actor = () => get().currentUserId;

    /**
     * Apply a pure domain result: commit on success, report on failure.
     * `record` turns a successful result into a history entry; it gets the state
     * from before the change, so it can diff old against new.
     */
    function commit<T>(
      result: Result<Change<T>>,
      record?: (value: T, before: DataState) => ActivityEvent | null,
    ): Result<T> {
      if (result.error) {
        onError(result.error);
        return { error: result.error };
      }
      const event = record?.(result.data.value, get().data);
      const filesBefore = get().data.attachments;
      set({ data: event ? appendActivity(result.data.state, event) : result.data.state });
      // Files whose records are gone (removed, or their task was deleted) are deleted too.
      const orphaned = Object.keys(filesBefore).filter((id) => !(id in get().data.attachments));
      if (orphaned.length > 0) void blobs.delete(orphaned).catch(() => {});
      return { data: result.data.value };
    }

    const actions: AppActions = {
      async bootstrap() {
        set({ boot: 'loading' });
        await sleep(get().settings.latencyMs * 1.5);
        set({ boot: 'ready' });
      },

      switchUser(userId) {
        if (!get().data.users[userId]) return;
        set({ currentUserId: userId });
      },

      async openList(listId) {
        set({ loadingListId: listId });
        await sleep(get().settings.latencyMs);
        // Ignore stale responses if the user navigated elsewhere meanwhile.
        if (get().loadingListId === listId) set({ loadingListId: null });
        const denied = guardViewList(get().data, actor(), listId);
        return denied ? { error: denied } : { data: get().data.containers[listId] };
      },

      setSettings(patch) {
        set({ settings: { ...get().settings, ...patch } });
      },

      resetDemo() {
        set({ data: createSeed(), pendingTaskIds: {} });
        void blobs.clear().catch(() => {});
      },

      createContainer: (input) => commit(containers.createContainer(get().data, actor(), input, now())),
      renameContainer: (id, name) => commit(containers.renameContainer(get().data, actor(), id, name, now())),
      setVisibility: (id, v) => commit(containers.setVisibility(get().data, actor(), id, v, now())),
      archiveContainer: (id) => commit(containers.archiveContainer(get().data, actor(), id, now())),
      restoreContainer: (id) => commit(containers.restoreContainer(get().data, actor(), id, now())),
      reorderContainer: (id, toIndex) => commit(containers.reorderContainer(get().data, actor(), id, toIndex, now())),
      setGrant: (input) => commit(containers.setGrant(get().data, actor(), input)),

      addStatus: (listId, input) => commit(statuses.addStatus(get().data, actor(), listId, input)),
      updateStatus: (id, input) => commit(statuses.updateStatus(get().data, actor(), id, input)),
      deleteStatus: (id) => commit(statuses.deleteStatus(get().data, actor(), id)),

      createTask: (input) =>
        commit(tasks.createTask(get().data, actor(), input, now()), (task) => taskCreatedEvent(task, actor())),
      updateTask: (id, patch) =>
        commit(tasks.updateTask(get().data, actor(), id, patch, now()), (task, before) =>
          taskUpdatedEvent(before.tasks[id], task, actor()),
        ),
      deleteTask: (id) => commit(tasks.deleteTask(get().data, actor(), id)),
      discardUntouchedDraft: (id) => commit(tasks.discardUntouchedDraft(get().data, actor(), id)),

      async moveTask(input) {
        const before = get().data.tasks;
        const eventsBefore = get().data.activity;
        const result = commit(tasks.moveTask(get().data, actor(), input, now()), (task, prev) =>
          taskUpdatedEvent(prev.tasks[input.taskId], task, actor()),
        );
        if (result.error) return result;

        const after = get().data.tasks;
        const changed = Object.keys(after).filter((id) => after[id] !== before[id]);
        const addedEvents = Object.keys(get().data.activity).filter((id) => !eventsBefore[id]);
        set({ pendingTaskIds: { ...get().pendingTaskIds, [input.taskId]: true } });

        const saved = await simulateSave(get().settings);

        const pending = { ...get().pendingTaskIds };
        delete pending[input.taskId];
        if (!saved.error) {
          set({ pendingTaskIds: pending });
          return result;
        }

        // Roll back only the records this move touched, and only if nothing
        // else has modified them since (a later move wins over our rollback).
        const current = get().data.tasks;
        const restored = { ...current };
        for (const id of changed) {
          if (current[id] === after[id]) restored[id] = before[id];
        }
        // The move never happened, so its history entry goes too.
        const activity = { ...get().data.activity };
        for (const id of addedEvents) delete activity[id];
        set({ data: { ...get().data, tasks: restored, activity }, pendingTaskIds: pending });
        const error: StoreError = { code: 'NETWORK', message: "Couldn't save the move — it was reverted." };
        onError(error);
        return { error };
      },

      addComment: (input) => commit(comments.addComment(get().data, actor(), input, now())),
      markMentionsRead: (ids) => commit(comments.markMentionsRead(get().data, actor(), ids)),

      async addAttachment(taskId, file) {
        const input = { id: newId('att'), taskId, name: file.name, mime: file.type, size: file.size };
        const check = attachments.addAttachment(get().data, actor(), input, now());
        if (check.error) {
          onError(check.error);
          return { error: check.error };
        }
        try {
          await blobs.put(input.id, file);
        } catch {
          const error: StoreError = { code: 'NETWORK', message: `Couldn't store “${file.name}” in this browser.` };
          onError(error);
          return { error };
        }
        // The task may have been deleted, or access lost, while the file was saving.
        const result = commit(attachments.addAttachment(get().data, actor(), input, now()));
        if (result.error) await blobs.delete([input.id]).catch(() => {});
        return result;
      },

      startSprint: (input) => commit(sprints.startSprint(get().data, actor(), input, now())),
      endSprint: (id) => commit(sprints.endSprint(get().data, actor(), id, now())),

      removeAttachment: (id) => commit(attachments.removeAttachment(get().data, actor(), id)),

      async getAttachmentBlob(id) {
        const found = attachments.guardAttachment(get().data, actor(), id);
        if (found.error) return found;
        const blob = await blobs.get(id).catch(() => undefined);
        return blob
          ? { data: blob }
          : { error: { code: 'NOT_FOUND', message: 'This file is no longer stored in this browser.' } };
      },
    };

    return {
      data: initial,
      currentUserId: opts.currentUserId ?? Object.values(initial.users).find((u) => u.role === 'admin')!.id,
      boot: opts.ready ? 'ready' : 'loading',
      loadingListId: null,
      pendingTaskIds: {},
      settings: { latencyMs: 350, simulateFailures: false, ...opts.settings },
      actions,
    };
  });
}
