/**
 * Sprints: a time-boxed run of work on one list. Admins start and end them; anyone
 * who can see the list can see the progress and the finished reports.
 *
 * Which tasks count: the top-level tasks that were still open when the sprint
 * started, plus any created in the list since. Ending freezes a report: what was
 * done, what spilled over (still open, so it stays in the list for next time), and
 * a tally per person.
 */
import type { Change } from './containers';
import { newId } from './ids';
import { guardManage, guardViewList } from './permissions';
import { fail, notFound, ok } from './result';
import type { DataState, ID, ISODate, Result, Sprint, SprintPersonResult, SprintReport, Task } from './types';

export const SPRINT_NAME_MAX = 60;

/** The sprint currently running on a list, if any. */
export function activeSprint(data: Pick<DataState, 'sprints'>, listId: ID): Sprint | undefined {
  return Object.values(data.sprints).find((s) => s.listId === listId && !s.endedAt);
}

const isDone = (data: Pick<DataState, 'statuses'>, task: Task) => data.statuses[task.statusId]?.category === 'done';

/** The tasks a sprint counts: its starting snapshot that is still in the list, plus tasks created since. */
export function sprintTasks(data: Pick<DataState, 'tasks'>, sprint: Sprint): Task[] {
  const planned = new Set(sprint.taskIds);
  return Object.values(data.tasks).filter(
    (t) =>
      t.primaryListId === sprint.listId && !t.parentTaskId && (planned.has(t.id) || t.createdAt > sprint.startedAt),
  );
}

/** Freeze the outcome of a sprint at this moment. */
function buildReport(data: Pick<DataState, 'tasks' | 'statuses'>, sprint: Sprint): SprintReport {
  const tasks = sprintTasks(data, sprint).map((t) => ({
    taskId: t.id,
    title: t.title,
    assigneeIds: t.assigneeIds,
    status: data.statuses[t.statusId]?.name ?? 'Unknown',
    outcome: isDone(data, t) ? ('done' as const) : ('spilled' as const),
  }));

  const tally = new Map<ID | null, SprintPersonResult>();
  for (const t of tasks) {
    for (const userId of t.assigneeIds.length > 0 ? t.assigneeIds : [null]) {
      const row = tally.get(userId) ?? { userId, done: 0, spilled: 0 };
      row[t.outcome] += 1;
      tally.set(userId, row);
    }
  }
  // Busiest first; the unassigned bucket goes last.
  const people = [...tally.values()].sort(
    (a, b) =>
      Number(a.userId === null) - Number(b.userId === null) ||
      b.done + b.spilled - (a.done + a.spilled) ||
      String(a.userId).localeCompare(String(b.userId)),
  );

  const done = tasks.filter((t) => t.outcome === 'done').length;
  return { total: tasks.length, done, spilled: tasks.length - done, people, tasks };
}

/** Live progress of a running sprint. */
export function sprintProgress(data: Pick<DataState, 'tasks' | 'statuses'>, sprint: Sprint) {
  const tasks = sprintTasks(data, sprint);
  const done = tasks.filter((t) => isDone(data, t)).length;
  return { total: tasks.length, done, open: tasks.length - done };
}

export interface StartSprintInput {
  listId: ID;
  name: string;
  /** The planned last day, if any. */
  endsOn?: ISODate | null;
}

/** Start a sprint on a list (admin only). One at a time per list. */
export function startSprint(
  data: DataState,
  actorId: ID,
  input: StartSprintInput,
  now: ISODate,
): Result<Change<Sprint>> {
  const denied = guardManage(data, actorId, 'start sprints') ?? guardViewList(data, actorId, input.listId);
  if (denied) return { error: denied };

  const name = input.name.trim();
  if (!name) return fail('VALIDATION', 'Give the sprint a name.');
  if (name.length > SPRINT_NAME_MAX) {
    return fail('VALIDATION', `Sprint names must be ${SPRINT_NAME_MAX} characters or fewer.`);
  }
  if (input.endsOn) {
    if (Number.isNaN(Date.parse(input.endsOn))) return fail('VALIDATION', 'The end date isn’t a valid date.');
    // Compared by calendar day, so ending "today" is allowed.
    if (input.endsOn.slice(0, 10) < now.slice(0, 10)) return fail('VALIDATION', 'The end date can’t be in the past.');
  }
  const running = activeSprint(data, input.listId);
  if (running) return fail('CONFLICT', `“${running.name}” is already running on this list. End it first.`);

  const sprint: Sprint = {
    id: newId('spr'),
    listId: input.listId,
    name,
    startedAt: now,
    endsOn: input.endsOn ? new Date(input.endsOn).toISOString() : null,
    startedBy: actorId,
    taskIds: Object.values(data.tasks)
      .filter((t) => t.primaryListId === input.listId && !t.parentTaskId && !isDone(data, t))
      .map((t) => t.id),
    endedAt: null,
    endedBy: null,
    report: null,
  };
  return ok({ state: { ...data, sprints: { ...data.sprints, [sprint.id]: sprint } }, value: sprint });
}

/** End a running sprint and freeze its report (admin only). */
export function endSprint(data: DataState, actorId: ID, sprintId: ID, now: ISODate): Result<Change<Sprint>> {
  const denied = guardManage(data, actorId, 'end sprints');
  if (denied) return { error: denied };
  const sprint = data.sprints[sprintId];
  if (!sprint) return notFound('Sprint');
  const hidden = guardViewList(data, actorId, sprint.listId);
  if (hidden) return { error: hidden };
  if (sprint.endedAt) return fail('CONFLICT', `“${sprint.name}” has already ended.`);

  const ended: Sprint = { ...sprint, endedAt: now, endedBy: actorId, report: buildReport(data, sprint) };
  return ok({ state: { ...data, sprints: { ...data.sprints, [sprintId]: ended } }, value: ended });
}
