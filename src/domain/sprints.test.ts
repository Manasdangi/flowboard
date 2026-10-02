import { describe, expect, it } from 'vitest';
import { createSeed, SEED_IDS, statusId } from '@/data/seed';
import { selectSprintReport, selectSprints } from './selectors';
import { activeSprint, endSprint, SPRINT_NAME_MAX, startSprint } from './sprints';
import { createTask, updateTask } from './tasks';
import type { DataState } from './types';

const { users: U, lists: L } = SEED_IDS;
const base = createSeed(new Date('2026-06-01T12:00:00Z'));
const T0 = '2026-06-01T12:00:00.000Z';
const T1 = '2026-06-08T12:00:00.000Z';
const T2 = '2026-06-15T12:00:00.000Z';

/** Backlog: 12 top-level tasks, 3 of them already Done (t_bl_9, t_bl_10, t_bl_11). */
const started = (): DataState => startSprint(base, U.alice, { listId: L.backlog, name: 'Sprint 1' }, T0).data!.state;

describe('startSprint', () => {
  it('starts a sprint that counts only the tasks still open', () => {
    const sprint = startSprint(base, U.alice, { listId: L.backlog, name: '  Sprint 1  ' }, T0).data!.value;
    expect(sprint).toMatchObject({ name: 'Sprint 1', listId: L.backlog, startedBy: U.alice, endedAt: null });
    expect(sprint.taskIds).toHaveLength(9); // 12 minus the 3 already done
    expect(sprint.taskIds).not.toContain('t_bl_9');
    expect(sprint.taskIds).not.toContain('t_bl_6a'); // subtasks are never counted
  });

  it('is admin only', () => {
    expect(startSprint(base, U.bob, { listId: L.backlog, name: 'Sprint 1' }, T0).error?.code).toBe('FORBIDDEN');
    expect(startSprint(base, U.bob, { listId: L.backlog, name: 'x' }, T0).error?.message).toMatch(/start sprints/);
  });

  it('validates the name and the end date', () => {
    const start = (name: string, endsOn?: string) =>
      startSprint(base, U.alice, { listId: L.backlog, name, endsOn }, T0);
    expect(start('   ').error?.code).toBe('VALIDATION');
    expect(start('x'.repeat(SPRINT_NAME_MAX + 1)).error?.code).toBe('VALIDATION');
    expect(start('Sprint', 'not a date').error?.code).toBe('VALIDATION');
    expect(start('Sprint', '2026-05-30T17:00:00.000Z').error?.message).toMatch(/in the past/);
    expect(start('Sprint', '2026-06-01T17:00:00.000Z').data).toBeDefined(); // today is fine
  });

  it('allows one running sprint per list, and lists are independent', () => {
    const data = started();
    expect(startSprint(data, U.alice, { listId: L.backlog, name: 'Again' }, T0).error?.code).toBe('CONFLICT');
    expect(startSprint(data, U.alice, { listId: L.sprint, name: 'Other list' }, T0).data).toBeDefined();
  });

  it('is refused for an archived or missing list', () => {
    expect(startSprint(base, U.alice, { listId: L.retro, name: 'Old' }, T0).error?.code).toBe('NOT_FOUND');
    expect(startSprint(base, U.alice, { listId: 'nope', name: 'Old' }, T0).error?.code).toBe('NOT_FOUND');
  });
});

describe('endSprint and the report', () => {
  /** Sprint 1 on Backlog, then: finish one task, add and finish a new one, add an open one, delete none. */
  function runSprint() {
    let data = started();
    const done = statusId(L.backlog, 'done');
    data = updateTask(data, U.alice, 't_bl_1', { statusId: done }, T1).data!.state; // Bob's task, finished
    data = updateTask(data, U.alice, 't_bl_6', { statusId: done }, T1).data!.state; // Alice + Bob, finished
    const added = createTask(data, U.alice, { listId: L.backlog, title: 'Added mid-sprint' }, T1).data!;
    data = updateTask(added.state, U.alice, added.value.id, { statusId: done }, T1).data!.state;
    return data;
  }

  it('counts done and spilled over tasks', () => {
    const data = runSprint();
    const ended = endSprint(data, U.alice, activeSprint(data, L.backlog)!.id, T2).data!;
    const report = ended.value.report!;
    // 9 planned + 1 added = 10. Finished: t_bl_1, t_bl_6, and the added one.
    expect(report).toMatchObject({ total: 10, done: 3, spilled: 7 });
    expect(ended.value.endedAt).toBe(T2);
    expect(report.tasks.find((t) => t.taskId === 't_bl_2')).toMatchObject({ outcome: 'spilled', status: 'To do' });
    expect(report.tasks.find((t) => t.title === 'Added mid-sprint')?.outcome).toBe('done');
  });

  it('tallies each person, counting a shared task for both assignees', () => {
    const data = runSprint();
    const { people } = endSprint(data, U.alice, activeSprint(data, L.backlog)!.id, T2).data!.value.report!;
    const of = (id: string | null) => people.find((p) => p.userId === id);
    // Bob: t_bl_1 and t_bl_6 done; his other open tasks spilled.
    expect(of(U.bob)).toMatchObject({ done: 2 });
    expect(of(U.bob)!.spilled).toBeGreaterThan(0);
    // Alice shares t_bl_6, which was finished.
    expect(of(U.alice)!.done).toBe(1);
    // Unassigned tasks have their own row, and it sorts last.
    expect(of(null)).toBeDefined();
    expect(people[people.length - 1].userId).toBeNull();
  });

  it('freezes the report: later edits do not change it', () => {
    const data = runSprint();
    const ended = endSprint(data, U.alice, activeSprint(data, L.backlog)!.id, T2).data!;
    const after = updateTask(ended.state, U.alice, 't_bl_2', { title: 'Renamed later' }, T2).data!.state;
    const view = selectSprintReport(after, U.alice, ended.value.id).data!;
    expect(view.tasks.find((t) => t.id === 't_bl_2')?.title).not.toBe('Renamed later');
    expect(view.report.total).toBe(10);
  });

  it('is admin only, and cannot end a sprint twice', () => {
    const data = started();
    const id = activeSprint(data, L.backlog)!.id;
    expect(endSprint(data, U.bob, id, T1).error?.code).toBe('FORBIDDEN');
    const ended = endSprint(data, U.alice, id, T1).data!.state;
    expect(endSprint(ended, U.alice, id, T2).error?.code).toBe('CONFLICT');
    expect(endSprint(data, U.alice, 'spr_nope', T1).error?.code).toBe('NOT_FOUND');
  });

  it('lets a new sprint start once the last one has ended, carrying spilled tasks into it', () => {
    let data = started();
    data = endSprint(data, U.alice, activeSprint(data, L.backlog)!.id, T1).data!.state;
    const next = startSprint(data, U.alice, { listId: L.backlog, name: 'Sprint 2' }, T2).data!;
    expect(next.value.taskIds).toHaveLength(9); // everything that spilled over is open again
  });
});

describe('sprint read models', () => {
  it('reports live progress for the running sprint and lists past ones newest first', () => {
    let data = started();
    data = updateTask(data, U.alice, 't_bl_1', { statusId: statusId(L.backlog, 'done') }, T1).data!.state;
    expect(selectSprints(data, U.bob, L.backlog).data!.active).toMatchObject({ total: 9, done: 1, open: 8 });

    data = endSprint(data, U.alice, activeSprint(data, L.backlog)!.id, T1).data!.state;
    data = startSprint(data, U.alice, { listId: L.backlog, name: 'Sprint 2' }, T1).data!.state;
    data = endSprint(data, U.alice, activeSprint(data, L.backlog)!.id, T2).data!.state;
    const model = selectSprints(data, U.alice, L.backlog).data!;
    expect(model.active).toBeNull();
    expect(model.past.map((s) => s.name)).toEqual(['Sprint 2', 'Sprint 1']);
  });

  it('shows names in the report view and withholds it while the sprint is still running', () => {
    const data = started();
    const id = activeSprint(data, L.backlog)!.id;
    expect(selectSprintReport(data, U.alice, id).error?.code).toBe('CONFLICT');

    const ended = endSprint(data, U.alice, id, T1).data!.state;
    const view = selectSprintReport(ended, U.bob, id).data!;
    expect(view).toMatchObject({ listName: 'Backlog', startedBy: { name: 'Alice Chen' } });
    expect(view.people.some((p) => p.user?.name === 'Bob Martinez')).toBe(true);
  });

  it('never exposes a sprint on a list the viewer cannot see', () => {
    const data = startSprint(base, U.alice, { listId: L.sprint, name: 'Secret' }, T0).data!.state;
    const id = activeSprint(data, L.sprint)!.id;
    const ended = endSprint(data, U.alice, id, T1).data!.state;
    // Carol is denied on Sprint 14.
    expect(selectSprints(ended, U.carol, L.sprint).error?.code).toBe('FORBIDDEN');
    expect(selectSprintReport(ended, U.carol, id).error?.code).toBe('FORBIDDEN');
    expect(selectSprintReport(ended, U.bob, id).data).toBeDefined();
  });
});
