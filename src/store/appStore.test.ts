import { describe, expect, it, vi } from 'vitest';
import { createSeed, SEED_IDS, statusId } from '@/data/seed';
import { columnTasks } from '@/domain/tasks';
import { selectVisibleTree } from '@/domain/tree';
import type { StoreError } from '@/domain/types';
import { createAppStore } from './appStore';

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
      selectVisibleTree(store.getState().data, store.getState().currentUserId).map(
        (n) => `${n.container.name}${n.restricted ? '*' : ''}`,
      );
    expect(names()).toEqual(['Engineering', 'Marketing']);
    actions.switchUser(U.bob);
    expect(names()).toEqual(['Engineering', 'Marketing*']);
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
