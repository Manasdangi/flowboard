/**
 * Task mutations. Pure: (state, actorId, input, now) → Result<Change>.
 * Every mutation runs the list access guard first — a member can edit tasks
 * only in lists they can see; moving between lists requires both.
 */
import type { Change } from './containers';
import { newId } from './ids';
import { byPosition, moveId, nextPosition, reindex } from './ordering';
import { guardTask, guardViewList } from './permissions';
import { fail, forbidden, ok } from './result';
import { mapStatusToList } from './statuses';
import type { DataState, ID, ISODate, Priority, Result, Task } from './types';

export const TITLE_MAX = 500;
export const PRIORITIES: Priority[] = ['urgent', 'high', 'normal', 'low', 'none'];

/** Top-level tasks in one status column, ordered. */
export function columnTasks(data: DataState, listId: ID, statusId: ID): Task[] {
  return Object.values(data.tasks)
    .filter((t) => t.primaryListId === listId && t.statusId === statusId && !t.parentTaskId)
    .sort(byPosition);
}

export function subtasksOf(data: DataState, parentId: ID): Task[] {
  return Object.values(data.tasks)
    .filter((t) => t.parentTaskId === parentId)
    .sort(byPosition);
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface TaskFields {
  title: string;
  description: string;
  statusId: ID;
  priority: Priority;
  assigneeIds: ID[];
  dueDate: ISODate | null;
}

function validateFields(data: DataState, listId: ID, fields: Partial<TaskFields>): Result<Partial<TaskFields>> {
  const out: Partial<TaskFields> = { ...fields };
  if (fields.title !== undefined) {
    const title = fields.title.trim();
    if (!title) return fail('VALIDATION', 'Title is required.');
    if (title.length > TITLE_MAX) return fail('VALIDATION', `Title must be ${TITLE_MAX} characters or fewer.`);
    out.title = title;
  }
  if (fields.statusId !== undefined) {
    const status = data.statuses[fields.statusId];
    if (!status || status.listId !== listId) {
      return fail('VALIDATION', "That status isn't defined on this list.");
    }
  }
  if (fields.priority !== undefined && !PRIORITIES.includes(fields.priority)) {
    return fail('VALIDATION', `Unknown priority "${fields.priority}".`);
  }
  if (fields.assigneeIds !== undefined) {
    const unknown = fields.assigneeIds.find((id) => !data.users[id]);
    if (unknown) return fail('VALIDATION', `Unknown assignee "${unknown}".`);
    out.assigneeIds = [...new Set(fields.assigneeIds)];
  }
  if (fields.dueDate) {
    if (Number.isNaN(Date.parse(fields.dueDate))) return fail('VALIDATION', 'Due date must be an ISO datetime.');
    out.dueDate = new Date(fields.dueDate).toISOString();
  }
  return ok(out);
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export interface CreateTaskInput extends Partial<TaskFields> {
  listId: ID;
  title: string;
  parentTaskId?: ID | null;
}

export function createTask(data: DataState, actorId: ID, input: CreateTaskInput, now: ISODate): Result<Change<Task>> {
  const denied = guardViewList(data, actorId, input.listId);
  if (denied) return { error: denied };

  let parentTaskId: ID | null = null;
  if (input.parentTaskId) {
    const parent = data.tasks[input.parentTaskId];
    if (!parent || parent.primaryListId !== input.listId)
      return fail('VALIDATION', 'Parent task not found in this list.');
    if (parent.parentTaskId) return fail('VALIDATION', 'Subtasks can only be one level deep.');
    parentTaskId = parent.id;
  }

  const statuses = Object.values(data.statuses)
    .filter((s) => s.listId === input.listId)
    .sort(byPosition);
  const fields = validateFields(data, input.listId, {
    ...input,
    statusId: input.statusId ?? statuses[0]?.id,
  });
  if (fields.error) return fields;
  const statusId = fields.data.statusId!;

  const siblings = parentTaskId ? subtasksOf(data, parentTaskId) : columnTasks(data, input.listId, statusId);
  const task: Task = {
    id: newId('task'),
    title: fields.data.title!,
    description: fields.data.description ?? '',
    primaryListId: input.listId,
    statusId,
    priority: fields.data.priority ?? 'none',
    assigneeIds: fields.data.assigneeIds ?? [],
    dueDate: fields.data.dueDate ?? null,
    position: nextPosition(siblings),
    parentTaskId,
    createdBy: actorId,
    createdAt: now,
    updatedAt: now,
  };
  return ok({ state: { ...data, tasks: { ...data.tasks, [task.id]: task } }, value: task });
}

export function updateTask(
  data: DataState,
  actorId: ID,
  taskId: ID,
  patch: Partial<TaskFields>,
  now: ISODate,
): Result<Change<Task>> {
  const found = guardTask(data, actorId, taskId);
  if (found.error) return found;
  const task = found.data;

  const fields = validateFields(data, task.primaryListId, patch);
  if (fields.error) return fields;

  const next: Task = { ...task, ...fields.data, updatedAt: now };
  // A status change drops a top-level task at the bottom of its new column.
  if (!task.parentTaskId && fields.data.statusId && fields.data.statusId !== task.statusId) {
    next.position = nextPosition(columnTasks(data, task.primaryListId, fields.data.statusId));
  }
  return ok({ state: { ...data, tasks: { ...data.tasks, [taskId]: next } }, value: next });
}

export interface MoveTaskInput {
  taskId: ID;
  /** Target status (kanban column). Defaults to a mapped status when changing lists. */
  toStatusId?: ID;
  /** Target list. Defaults to the task's current list. */
  toListId?: ID;
  /** Index within the target column. Defaults to the end. */
  toIndex?: number;
}

/**
 * Kanban drop / reorder / move-to-list. Re-indexes the target column so
 * positions stay dense and deterministic. Subtasks travel with their parent.
 */
export function moveTask(data: DataState, actorId: ID, input: MoveTaskInput, now: ISODate): Result<Change<Task>> {
  const found = guardTask(data, actorId, input.taskId);
  if (found.error) return found;
  const task = found.data;
  if (task.parentTaskId) return fail('VALIDATION', 'Move the parent task instead of a subtask.');

  const toListId = input.toListId ?? task.primaryListId;
  const changingList = toListId !== task.primaryListId;
  if (changingList) {
    const denied = guardViewList(data, actorId, toListId);
    if (denied) {
      return denied.code === 'FORBIDDEN'
        ? forbidden("You don't have access to the destination list.")
        : { error: denied };
    }
  }

  const toStatusId =
    input.toStatusId ?? (changingList ? mapStatusToList(data, task.statusId, toListId)?.id : task.statusId);
  const status = toStatusId ? data.statuses[toStatusId] : undefined;
  if (!status || status.listId !== toListId)
    return fail('VALIDATION', "That status isn't defined on the destination list.");

  const columnIds = columnTasks(data, toListId, status.id).map((t) => t.id);
  const ordered = moveId(columnIds, task.id, input.toIndex ?? columnIds.length);
  const positions = reindex(ordered);

  const tasks = { ...data.tasks };
  for (const [id, position] of positions) {
    const current = tasks[id];
    if (id === task.id) {
      tasks[id] = { ...current, position, statusId: status.id, primaryListId: toListId, updatedAt: now };
    } else if (current.position !== position) {
      tasks[id] = { ...current, position };
    }
  }
  if (changingList) {
    for (const sub of subtasksOf(data, task.id)) {
      const mapped = mapStatusToList(data, sub.statusId, toListId);
      tasks[sub.id] = { ...sub, primaryListId: toListId, statusId: mapped?.id ?? status.id, updatedAt: now };
    }
  }
  return ok({ state: { ...data, tasks }, value: tasks[task.id] });
}

export function deleteTask(data: DataState, actorId: ID, taskId: ID): Result<Change<Task[]>> {
  const found = guardTask(data, actorId, taskId);
  if (found.error) return found;
  const removed = [found.data, ...subtasksOf(data, taskId)];
  const tasks = { ...data.tasks };
  for (const t of removed) delete tasks[t.id];
  return ok({ state: { ...data, tasks }, value: removed });
}
