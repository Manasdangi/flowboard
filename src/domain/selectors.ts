/**
 * Read models. Each selector takes the current user and returns
 * `{ data }` or `{ error }` — a forbidden list yields a 403, never data.
 */
import { guardTask, guardViewList, usersWithAccess } from './permissions';
import { ok } from './result';
import { statusesForList } from './statuses';
import { columnTasks, subtasksOf } from './tasks';
import { selectVisibleLists, visibleAncestorsOf } from './tree';
import type { Container, DataState, ID, Priority, Result, Status, Task, User } from './types';

export interface BoardColumn {
  status: Status;
  tasks: Task[];
}

export interface BoardModel {
  list: Container;
  statuses: Status[];
  columns: BoardColumn[];
  /** parentId → { done, total } for subtask progress on cards. */
  subtaskProgress: Record<ID, { done: number; total: number }>;
  taskCount: number;
}

function progressFor(data: DataState, parents: Task[]) {
  const progress: BoardModel['subtaskProgress'] = {};
  for (const p of parents) {
    const subs = subtasksOf(data, p.id);
    if (subs.length) {
      progress[p.id] = {
        total: subs.length,
        done: subs.filter((s) => data.statuses[s.statusId]?.category === 'done').length,
      };
    }
  }
  return progress;
}

function matchesQuery(task: Task, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return task.title.toLowerCase().includes(q) || task.description.toLowerCase().includes(q);
}

export function selectBoard(data: DataState, userId: ID, listId: ID): Result<BoardModel> {
  const denied = guardViewList(data, userId, listId);
  if (denied) return { error: denied };
  const statuses = statusesForList(data, listId);
  const columns = statuses.map((status) => ({ status, tasks: columnTasks(data, listId, status.id) }));
  const all = columns.flatMap((c) => c.tasks);
  return ok({
    list: data.containers[listId],
    statuses,
    columns,
    subtaskProgress: progressFor(data, all),
    taskCount: all.length,
  });
}

// ---------------------------------------------------------------------------
// List view: sort + offset pagination over in-memory data
// ---------------------------------------------------------------------------

export type SortKey = 'manual' | 'title' | 'status' | 'priority' | 'dueDate';
export type SortDir = 'asc' | 'desc';
export interface SortSpec {
  key: SortKey;
  dir: SortDir;
}

const PRIORITY_RANK: Record<Priority, number> = { urgent: 0, high: 1, normal: 2, low: 3, none: 4 };

function sortTasks(tasks: Task[], sort: SortSpec, statuses: Record<ID, Status>): Task[] {
  const dir = sort.dir === 'asc' ? 1 : -1;
  const statusPos = (t: Task) => statuses[t.statusId]?.position ?? 0;
  const manual = (a: Task, b: Task) => statusPos(a) - statusPos(b) || a.position - b.position;

  const cmp: Record<SortKey, (a: Task, b: Task) => number> = {
    manual: (a, b) => dir * manual(a, b),
    title: (a, b) => dir * a.title.localeCompare(b.title) || manual(a, b),
    status: (a, b) => dir * (statusPos(a) - statusPos(b)) || a.position - b.position,
    // "asc" = most urgent first. "none" always sinks to the bottom.
    priority: (a, b) => {
      if (a.priority === 'none' || b.priority === 'none') {
        return (a.priority === 'none' ? 1 : 0) - (b.priority === 'none' ? 1 : 0) || manual(a, b);
      }
      return dir * (PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]) || manual(a, b);
    },
    // Tasks without a due date always sink to the bottom, in either direction.
    dueDate: (a, b) => {
      if (!a.dueDate || !b.dueDate) return (a.dueDate ? 0 : 1) - (b.dueDate ? 0 : 1) || manual(a, b);
      return dir * a.dueDate.localeCompare(b.dueDate) || manual(a, b);
    },
  };
  return [...tasks].sort(cmp[sort.key]);
}

export interface ListPage {
  rows: Task[];
  total: number;
  /** Offset for the next page, or null when exhausted. */
  nextOffset: number | null;
  subtaskProgress: BoardModel['subtaskProgress'];
}

/** Filter value meaning "tasks with no assignee", usable alongside user ids. */
export const UNASSIGNED = 'unassigned';

/** Empty filter = everything; otherwise a task matches if ANY chosen person is assigned (or it's unassigned and that's chosen). */
function matchesAssignees(task: Task, filter: string[]): boolean {
  if (filter.length === 0) return true;
  if (task.assigneeIds.length === 0) return filter.includes(UNASSIGNED);
  return task.assigneeIds.some((id) => filter.includes(id));
}

export function selectListPage(
  data: DataState,
  userId: ID,
  listId: ID,
  opts: { sort: SortSpec; offset?: number; limit?: number; query?: string; assignees?: string[] },
): Result<ListPage> {
  const denied = guardViewList(data, userId, listId);
  if (denied) return { error: denied };
  const all = Object.values(data.tasks).filter(
    (t) =>
      t.primaryListId === listId &&
      !t.parentTaskId &&
      matchesQuery(t, opts.query ?? '') &&
      matchesAssignees(t, opts.assignees ?? []),
  );
  const sorted = sortTasks(all, opts.sort, data.statuses);
  const offset = opts.offset ?? 0;
  const limit = opts.limit ?? sorted.length;
  const rows = sorted.slice(offset, offset + limit);
  const end = offset + rows.length;
  return ok({
    rows,
    total: sorted.length,
    nextOffset: end < sorted.length ? end : null,
    subtaskProgress: progressFor(data, rows),
  });
}

// ---------------------------------------------------------------------------
// Task detail
// ---------------------------------------------------------------------------

export interface TaskDetail {
  task: Task;
  list: Container;
  path: Container[];
  statuses: Status[];
  subtasks: Task[];
  parent: Task | null;
  assignableUsers: User[];
  /** Lists this user may move the task to. */
  movableLists: Container[];
}

export function selectTaskDetail(data: DataState, userId: ID, taskId: ID): Result<TaskDetail> {
  const found = guardTask(data, userId, taskId);
  if (found.error) return found;
  const task = found.data;
  return ok({
    task,
    list: data.containers[task.primaryListId],
    path: visibleAncestorsOf(data, userId, task.primaryListId),
    statuses: statusesForList(data, task.primaryListId),
    subtasks: subtasksOf(data, task.id),
    parent: task.parentTaskId ? (data.tasks[task.parentTaskId] ?? null) : null,
    assignableUsers: usersWithAccess(data, task.primaryListId),
    movableLists: selectVisibleLists(data, userId),
  });
}

// ---------------------------------------------------------------------------
// Search — only across lists the user can see
// ---------------------------------------------------------------------------

export interface SearchHit {
  task: Task;
  list: Container;
  status: Status | undefined;
}

export function searchTasks(data: DataState, userId: ID, query: string, limit = 20): SearchHit[] {
  if (!query.trim()) return [];
  const visible = new Map(selectVisibleLists(data, userId).map((l) => [l.id, l]));
  const hits: SearchHit[] = [];
  for (const task of Object.values(data.tasks)) {
    const list = visible.get(task.primaryListId);
    if (list && matchesQuery(task, query)) hits.push({ task, list, status: data.statuses[task.statusId] });
  }
  // Title matches rank above description-only matches, then most recently updated.
  const q = query.trim().toLowerCase();
  const inTitle = (h: SearchHit) => (h.task.title.toLowerCase().includes(q) ? 0 : 1);
  return hits
    .sort((a, b) => inTitle(a) - inTitle(b) || b.task.updatedAt.localeCompare(a.task.updatedAt))
    .slice(0, limit);
}
