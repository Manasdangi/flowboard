import { describe, expect, it, vi } from 'vitest';
import { createSeed, SEED_IDS, statusId } from '@/data/seed';
import { columnTasks } from '@/domain/tasks';
import { selectVisibleTree } from '@/domain/tree';
import type { StoreError } from '@/domain/types';
import { createAppStore } from './appStore';
import { createMemoryBlobStore } from './blobs';

const { users: U, lists: L, spaces: S, folders: F } = SEED_IDS;

function setup(userId: string = U.alice, settings = {}) {
  const errors: StoreError[] = [];
  const store = createAppStore({
    initialData: createSeed(new Date('2026-06-01T12:00:00Z')),
    currentUserId: userId,
    settings: { latencyMs: 0, ...settings },
    onError: (e) => errors.push(e),
    ready: true,
  });
  const actions = store.getState().actions;
  const column = (listId: string, key: string) =>
    columnTasks(store.getState().data, listId, statusId(listId, key)).map((t) => t.id);
  return { store, actions, errors, column };
}

describe('permission enforcement on mutations', () => {
  it('rejects task mutations in a denied list with a FORBIDDEN error and leaves state untouched', () => {
    const { store, actions, errors } = setup(U.carol);
    const before = store.getState().data;

    expect(actions.updateTask('t_sp_1', { title: 'hacked' }).error).toEqual({
      code: 'FORBIDDEN',
      message: expect.stringContaining("don't have access"),
    });
    expect(actions.createTask({ listId: L.sprint, title: 'nope' }).error?.code).toBe('FORBIDDEN');
    expect(actions.deleteTask('t_sp_1').error?.code).toBe('FORBIDDEN');
    expect(store.getState().data).toBe(before);
    expect(errors).toHaveLength(3);
  });

  it('lets members edit tasks in lists they are granted', () => {
    const { actions } = setup(U.bob);
    expect(actions.updateTask('t_sec_2', { priority: 'urgent' }).data?.priority).toBe('urgent');
  });

  it('blocks moving a task into a list the member cannot see', async () => {
    const { actions } = setup(U.bob);
    const result = await actions.moveTask({ taskId: 't_bl_1', toListId: L.campaigns });
    expect(result.error).toMatchObject({ code: 'FORBIDDEN', message: expect.stringContaining('destination') });
  });

  it('restricts container structure changes to admins', () => {
    const { actions } = setup(U.bob);
    expect(actions.createContainer({ parentId: F.q2, name: 'Bob’s list' }).error?.code).toBe('FORBIDDEN');
    expect(actions.renameContainer(L.backlog, 'x').error?.code).toBe('FORBIDDEN');
    expect(actions.archiveContainer(L.backlog).error?.code).toBe('FORBIDDEN');
    expect(actions.setGrant({ resourceId: S.marketing, userId: U.bob, mode: 'allow' }).error?.code).toBe('FORBIDDEN');
  });

  it('switching users immediately changes what the tree returns', () => {
    const { store, actions } = setup(U.alice);
    const names = () =>
      selectVisibleTree(store.getState().data, store.getState().currentUserId).map((n) => n.container.name);
    expect(names()).toEqual(['Engineering', 'Marketing']);
    actions.switchUser(U.bob);
    expect(names()).toEqual(['Engineering']);
  });

  it('an admin sharing a container makes it visible to that member', async () => {
    const { actions } = setup(U.alice);
    actions.setGrant({ resourceId: L.campaigns, userId: U.bob, mode: 'allow' });
    actions.switchUser(U.bob);
    await expect(actions.openList(L.campaigns)).resolves.toMatchObject({ data: { id: L.campaigns } });
  });

  it('openList reports 403 for denied lists', async () => {
    const { actions } = setup(U.bob);
    expect((await actions.openList(L.campaigns)).error?.code).toBe('FORBIDDEN');
  });
});

describe('containers', () => {
  it('enforces the parent type hierarchy and seeds statuses for new lists', () => {
    const { store, actions } = setup();
    const folder = actions.createContainer({ parentId: S.engineering, name: 'Q3' });
    expect(folder.data?.type).toBe('folder');
    const list = actions.createContainer({ parentId: folder.data!.id, name: 'Ideas' });
    expect(list.data?.type).toBe('list');
    expect(
      Object.values(store.getState().data.statuses)
        .filter((s) => s.listId === list.data!.id)
        .map((s) => s.category),
    ).toEqual(['todo', 'in_progress', 'done']);
    expect(actions.createContainer({ parentId: list.data!.id, name: 'Nested' }).error).toMatchObject({
      code: 'VALIDATION',
    });
    expect(actions.createContainer({ parentId: F.q2, name: '   ' }).error?.code).toBe('VALIDATION');
  });

  it('renames the workspace for admins only', () => {
    const admin = setup(U.alice);
    expect(admin.actions.renameContainer(SEED_IDS.workspace, 'Acme HQ').data?.name).toBe('Acme HQ');
    const member = setup(U.bob);
    expect(member.actions.renameContainer(SEED_IDS.workspace, 'Mine').error?.code).toBe('FORBIDDEN');
  });

  it('reorders siblings', () => {
    const { store, actions } = setup();
    actions.reorderContainer(L.security, 0);
    const order = Object.values(store.getState().data.containers)
      .filter((c) => c.parentId === F.q2 && !c.archivedAt)
      .sort((a, b) => a.position - b.position)
      .map((c) => c.id);
    expect(order).toEqual([L.security, L.backlog, L.sprint]);
  });

  it('archives (soft delete) and restores a subtree', () => {
    const { store, actions } = setup();
    actions.archiveContainer(F.q2);
    expect(store.getState().data.containers[F.q2].archivedAt).not.toBeNull();
    expect(store.getState().actions.updateTask('t_bl_1', { title: 'x' }).error?.code).toBe('NOT_FOUND');
    actions.restoreContainer(F.q2);
    expect(store.getState().actions.updateTask('t_bl_1', { title: 'x' }).data?.title).toBe('x');
  });
});

describe('tasks', () => {
  it('validates title length and status membership', () => {
    const { actions } = setup();
    expect(actions.createTask({ listId: L.backlog, title: 'a'.repeat(501) }).error?.code).toBe('VALIDATION');
    expect(
      actions.createTask({ listId: L.backlog, title: 'ok', statusId: statusId(L.sprint, 'review') }).error?.message,
    ).toMatch(/status/);
    const created = actions.createTask({ listId: L.backlog, title: '  Trimmed  ' });
    expect(created.data).toMatchObject({ title: 'Trimmed', statusId: statusId(L.backlog, 'todo'), priority: 'none' });
  });

  it('reorders within a column and re-indexes positions', async () => {
    const { actions, column } = setup();
    const before = column(L.sprint, 'doing');
    expect(before).toEqual(['t_sp_3', 't_sp_4']);
    await actions.moveTask({ taskId: 't_sp_4', toStatusId: statusId(L.sprint, 'doing'), toIndex: 0 });
    expect(column(L.sprint, 'doing')).toEqual(['t_sp_4', 't_sp_3']);
  });

  it('moves a task across columns at a specific index', async () => {
    const { store, actions, column } = setup();
    await actions.moveTask({ taskId: 't_sp_1', toStatusId: statusId(L.sprint, 'done'), toIndex: 1 });
    expect(column(L.sprint, 'done')).toEqual(['t_sp_6', 't_sp_1', 't_sp_7']);
    expect(column(L.sprint, 'todo')).toEqual(['t_sp_2']);
    expect(store.getState().data.tasks.t_sp_1.statusId).toBe(statusId(L.sprint, 'done'));
  });

  it('moves between lists, re-maps status by name/category and carries subtasks', async () => {
    const { store, actions } = setup();
    await actions.moveTask({ taskId: 't_sp_3', toListId: L.security });
    const t = store.getState().data.tasks;
    // "In progress" has no name match on Security Audit → first in_progress status.
    expect(t.t_sp_3).toMatchObject({ primaryListId: L.security, statusId: statusId(L.security, 'investigating') });
    expect(t.t_sp_3a).toMatchObject({ primaryListId: L.security, statusId: statusId(L.security, 'resolved') });
  });

  it('supports multiple assignees and collapses duplicates', () => {
    const { actions } = setup();
    expect(actions.updateTask('t_bl_1', { assigneeIds: [U.alice, U.bob] }).data?.assigneeIds).toEqual([U.alice, U.bob]);
    expect(
      actions.createTask({ listId: L.backlog, title: 'x', assigneeIds: [U.alice, U.carol] }).data?.assigneeIds,
    ).toEqual([U.alice, U.carol]);
    expect(actions.updateTask('t_bl_1', { assigneeIds: [U.bob, U.bob] }).data?.assigneeIds).toEqual([U.bob]);
    expect(actions.updateTask('t_bl_1', { assigneeIds: ['u_nobody'] }).error?.code).toBe('VALIDATION');
  });

  it('deletes a task together with its subtasks', () => {
    const { store, actions } = setup();
    expect(actions.deleteTask('t_bl_6').data).toHaveLength(4);
    expect(store.getState().data.tasks.t_bl_6b).toBeUndefined();
  });

  it('discards a draft only while it is untouched', () => {
    // A ticking clock, so an edit always moves `updatedAt` past `createdAt`.
    let tick = 0;
    const store = createAppStore({
      initialData: createSeed(new Date('2026-06-01T12:00:00Z')),
      now: () => new Date(Date.UTC(2026, 5, 1, 12, 0, tick++)).toISOString(),
      ready: true,
    });
    const actions = store.getState().actions;

    const blank = actions.createTask({ listId: L.backlog, title: 'Untitled task' }).data!;
    expect(actions.discardUntouchedDraft(blank.id).data).toHaveLength(1);
    expect(store.getState().data.tasks[blank.id]).toBeUndefined();
    // Already gone (deleted from the drawer): a no-op, not a NOT_FOUND error.
    expect(actions.discardUntouchedDraft(blank.id)).toEqual({ data: [] });

    const edited = actions.createTask({ listId: L.backlog, title: 'Untitled task' }).data!;
    actions.updateTask(edited.id, { priority: 'high' });
    expect(actions.discardUntouchedDraft(edited.id)).toEqual({ data: [] });

    const withSubtask = actions.createTask({ listId: L.backlog, title: 'Untitled task' }).data!;
    actions.createTask({ listId: L.backlog, title: 'child', parentTaskId: withSubtask.id });
    expect(actions.discardUntouchedDraft(withSubtask.id)).toEqual({ data: [] });
    expect(store.getState().data.tasks[edited.id]).toBeDefined();
    expect(store.getState().data.tasks[withSubtask.id]).toBeDefined();
  });

  it('limits subtasks to one level', () => {
    const { actions } = setup();
    expect(actions.createTask({ listId: L.backlog, title: 'deep', parentTaskId: 't_bl_6a' }).error?.message).toMatch(
      /one level/,
    );
    expect(actions.createTask({ listId: L.backlog, title: 'sub', parentTaskId: 't_bl_6' }).data?.parentTaskId).toBe(
      't_bl_6',
    );
  });
});

describe('comments and activity', () => {
  const historyOf = (store: ReturnType<typeof setup>['store'], taskId: string) =>
    Object.values(store.getState().data.activity).filter((e) => e.taskId === taskId);

  it('records one entry per real change, none for a no-op or a rejected edit', () => {
    const { store, actions } = setup(U.alice);
    const before = historyOf(store, 't_sp_1').length;
    actions.updateTask('t_sp_1', { priority: 'low' });
    expect(historyOf(store, 't_sp_1')).toHaveLength(before + 1);

    actions.updateTask('t_sp_1', { priority: 'low' }); // nothing changed
    actions.updateTask('t_sp_1', { title: '   ' }); // VALIDATION
    expect(historyOf(store, 't_sp_1')).toHaveLength(before + 1);
  });

  it('records the creation of a new task', () => {
    const { store, actions } = setup(U.alice);
    const task = actions.createTask({ listId: L.backlog, title: 'Fresh' }).data!;
    expect(historyOf(store, task.id)).toMatchObject([{ kind: 'task.created', actorId: U.alice }]);
  });

  it('a rolled-back move leaves no history entry', async () => {
    const { store, actions } = setup(U.alice, { simulateFailures: true });
    const before = Object.keys(store.getState().data.activity);
    await actions.moveTask({ taskId: 't_sp_1', toStatusId: statusId(L.sprint, 'done'), toIndex: 0 });
    expect(Object.keys(store.getState().data.activity)).toEqual(before);
  });

  it('rejects a comment from a member without access and leaves state untouched', () => {
    const { store, actions, errors } = setup(U.carol);
    const before = store.getState().data;
    expect(actions.addComment({ taskId: 't_sp_1', body: 'hi' }).error?.code).toBe('FORBIDDEN');
    expect(store.getState().data).toBe(before);
    expect(errors).toHaveLength(1);
  });

  it('deleting a task also removes its comments and history', () => {
    const { store, actions } = setup(U.alice);
    actions.deleteTask('t_sp_3'); // along with subtasks t_sp_3a and t_sp_3b
    const gone = ['t_sp_3', 't_sp_3a', 't_sp_3b'];
    expect(Object.values(store.getState().data.comments).some((c) => gone.includes(c.taskId))).toBe(false);
    expect(Object.values(store.getState().data.activity).some((e) => gone.includes(e.taskId))).toBe(false);
  });
});

describe('attachments', () => {
  const png = (name = 'mock.png', bytes = 1024) => new File([new Uint8Array(bytes)], name, { type: 'image/png' });
  function withBlobs(userId: string = U.alice) {
    const blobs = createMemoryBlobStore();
    const errors: StoreError[] = [];
    const store = createAppStore({
      initialData: createSeed(new Date('2026-06-01T12:00:00Z')),
      currentUserId: userId,
      settings: { latencyMs: 0 },
      onError: (e) => errors.push(e),
      ready: true,
      blobs,
    });
    return { store, actions: store.getState().actions, blobs, errors };
  }

  it('stores the file, records it on the task and reads it back', async () => {
    const { store, actions, blobs } = withBlobs();
    const added = await actions.addAttachment('t_sp_1', png());
    expect(added.data).toMatchObject({ taskId: 't_sp_1', name: 'mock.png', mime: 'image/png', size: 1024 });
    expect(Object.keys(store.getState().data.attachments)).toEqual([added.data!.id]);
    expect(await blobs.keys()).toEqual([added.data!.id]);
    expect((await actions.getAttachmentBlob(added.data!.id)).data?.size).toBe(1024);
  });

  it('stores nothing when validation fails', async () => {
    const { store, actions, blobs, errors } = withBlobs();
    const svg = new File(['<svg/>'], 'x.svg', { type: 'image/svg+xml' });
    expect((await actions.addAttachment('t_sp_1', svg)).error?.code).toBe('VALIDATION');
    expect(await blobs.keys()).toEqual([]);
    expect(store.getState().data.attachments).toEqual({});
    expect(errors).toHaveLength(1);
  });

  it('refuses a member without access, for both adding and reading', async () => {
    const owner = withBlobs(U.alice);
    const { data } = await owner.actions.addAttachment('t_sp_1', png());
    owner.actions.switchUser(U.carol); // denied on Sprint 14
    expect((await owner.actions.addAttachment('t_sp_1', png())).error?.code).toBe('FORBIDDEN');
    expect((await owner.actions.getAttachmentBlob(data!.id)).error?.code).toBe('FORBIDDEN');
    expect(owner.actions.removeAttachment(data!.id).error?.code).toBe('FORBIDDEN');
    expect(Object.keys(owner.store.getState().data.attachments)).toEqual([data!.id]);
  });

  it('deletes the stored file when the attachment or its task is removed', async () => {
    const { actions, blobs } = withBlobs();
    const first = (await actions.addAttachment('t_sp_1', png('a.png'))).data!;
    const second = (await actions.addAttachment('t_sp_2', png('b.png'))).data!;

    actions.removeAttachment(first.id);
    await Promise.resolve();
    expect(await blobs.keys()).toEqual([second.id]);

    actions.deleteTask('t_sp_2');
    await Promise.resolve();
    expect(await blobs.keys()).toEqual([]);
  });

  it('keeps a draft that has an attachment when its drawer closes', async () => {
    const { store, actions } = withBlobs();
    const draft = actions.createTask({ listId: L.backlog, title: 'Untitled task' }).data!;
    await actions.addAttachment(draft.id, png());
    expect(actions.discardUntouchedDraft(draft.id)).toEqual({ data: [] });
    expect(store.getState().data.tasks[draft.id]).toBeDefined();
  });

  it('clears stored files when the demo data is reset', async () => {
    const { actions, blobs } = withBlobs();
    await actions.addAttachment('t_sp_1', png());
    actions.resetDemo();
    await Promise.resolve();
    expect(await blobs.keys()).toEqual([]);
  });
});

describe('sprints', () => {
  it('an admin starts a sprint, finishes a task, ends it and gets a frozen report', () => {
    const { store, actions } = setup(U.alice);
    const started = actions.startSprint({ listId: L.backlog, name: 'Sprint 1' });
    expect(started.data).toMatchObject({ name: 'Sprint 1', endedAt: null });

    actions.updateTask('t_bl_1', { statusId: statusId(L.backlog, 'done') });
    const ended = actions.endSprint(started.data!.id);
    expect(ended.data?.report).toMatchObject({ total: 9, done: 1, spilled: 8 });
    expect(store.getState().data.sprints[started.data!.id].endedAt).not.toBeNull();
  });

  it('refuses members with a FORBIDDEN toast and leaves the data untouched', () => {
    const { store, actions, errors } = setup(U.bob);
    const before = store.getState().data;
    expect(actions.startSprint({ listId: L.backlog, name: 'Mine' }).error?.code).toBe('FORBIDDEN');
    expect(store.getState().data).toBe(before);
    expect(errors).toMatchObject([{ code: 'FORBIDDEN', message: expect.stringContaining('start sprints') }]);
  });

  it('allows only one running sprint per list', () => {
    const { actions } = setup(U.alice);
    actions.startSprint({ listId: L.backlog, name: 'One' });
    expect(actions.startSprint({ listId: L.backlog, name: 'Two' }).error?.code).toBe('CONFLICT');
    expect(actions.startSprint({ listId: L.security, name: 'Elsewhere' }).data).toBeDefined();
  });
});

describe('optimistic moves', () => {
  it('applies immediately, marks the task pending, then settles', async () => {
    vi.useFakeTimers();
    const { store, actions, column } = setup(U.alice, { latencyMs: 300 });
    const promise = actions.moveTask({ taskId: 't_sp_1', toStatusId: statusId(L.sprint, 'doing'), toIndex: 0 });
    expect(column(L.sprint, 'doing')[0]).toBe('t_sp_1');
    expect(store.getState().pendingTaskIds.t_sp_1).toBe(true);
    await vi.runAllTimersAsync();
    expect((await promise).data?.id).toBe('t_sp_1');
    expect(store.getState().pendingTaskIds.t_sp_1).toBeUndefined();
    vi.useRealTimers();
  });

  it('rolls back when the save fails', async () => {
    const { store, actions, errors, column } = setup(U.alice, { simulateFailures: true });
    const before = store.getState().data.tasks;
    const result = await actions.moveTask({ taskId: 't_sp_1', toStatusId: statusId(L.sprint, 'done'), toIndex: 0 });
    expect(result.error?.code).toBe('NETWORK');
    expect(column(L.sprint, 'todo')).toEqual(['t_sp_1', 't_sp_2']);
    expect(store.getState().data.tasks.t_sp_1).toBe(before.t_sp_1);
    expect(errors.map((e) => e.code)).toEqual(['NETWORK']);
  });
});
