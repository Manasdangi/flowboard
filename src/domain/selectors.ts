/**
 * Read models. Each selector takes the current user and returns
 * `{ data }` or `{ error }` — a forbidden list yields a 403, never data.
 */
import { canViewContainer, guardTask, guardViewList, usersWithAccess } from './permissions';
import { fail, notFound, ok } from './result';
import { statusesForList } from './statuses';
import { activeSprint, sprintProgress } from './sprints';
import { columnTasks, subtasksOf } from './tasks';
import { selectVisibleLists, visibleAncestorsOf } from './tree';
import type {
  ActivityChange,
  ActivityEvent,
  Attachment,
  Container,
  DataState,
  DataWith,
  ID,
  ISODate,
  Priority,
  Result,
  Sprint,
  SprintReport,
  Status,
  Task,
  User,
} from './types';

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

/** Subtask done/total counts for each task that has subtasks (the "2/3" badge on cards and rows). */
function progressFor(data: Pick<DataState, 'tasks' | 'statuses'>, parents: Task[]) {
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

/** Case-insensitive match on the task name only (the list view's search). An empty query matches everything. */
function matchesTitle(task: Task, query: string): boolean {
  const q = query.trim().toLowerCase();
  return !q || task.title.toLowerCase().includes(q);
}

/** Case-insensitive match on title or description (the ⌘K search). An empty query matches everything. */
function matchesQuery(task: Task, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return task.title.toLowerCase().includes(q) || task.description.toLowerCase().includes(q);
}

/** Kanban model for one list: its statuses as columns, each with its ordered top-level tasks (403 if hidden). */
export function selectBoard(data: DataWith<'tasks' | 'statuses'>, userId: ID, listId: ID): Result<BoardModel> {
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

/** Sort for the list view. Ties fall back to board order; no due date / no priority always sink to the bottom. */
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

/** What the list and board toolbars narrow tasks by. Empty means no filter. */
export interface TaskFilters {
  /** Matches the task name. */
  query: string;
  /** Matches a task assigned to ANY of these people (or `UNASSIGNED`). */
  assignees: ID[];
}

export const NO_FILTERS: TaskFilters = { query: '', assignees: [] };

/** True when either filter is set. */
export const isFiltering = (f: TaskFilters): boolean => f.query.trim() !== '' || f.assignees.length > 0;

/** Does the task pass both filters? Used by the list page and by the board's cards. */
export function taskMatchesFilters(task: Task, filters: Partial<TaskFilters>): boolean {
  return matchesTitle(task, filters.query ?? '') && matchesAssignees(task, filters.assignees ?? []);
}

/** One page of the list view: filter → sort → slice, plus total and next offset (403 if hidden). */
export function selectListPage(
  data: DataWith<'tasks' | 'statuses'>,
  userId: ID,
  listId: ID,
  opts: { sort: SortSpec; offset?: number; limit?: number; query?: string; assignees?: string[] },
): Result<ListPage> {
  const denied = guardViewList(data, userId, listId);
  if (denied) return { error: denied };
  const all = Object.values(data.tasks).filter(
    (t) => t.primaryListId === listId && !t.parentTaskId && taskMatchesFilters(t, opts),
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
  /** Comments and history, oldest first. */
  activity: TimelineItem[];
  /** Images and videos on the task, oldest first. */
  attachments: Attachment[];
}

/** An ActivityChange with ids resolved to display names. `null` = deleted, or a list the viewer can't see. */
export type TimelineChange =
  | Exclude<ActivityChange, { field: 'status' | 'list' | 'assignees' }>
  | { field: 'status' | 'list'; from: string | null; to: string | null }
  | { field: 'assignees'; added: string[]; removed: string[] };

export type TimelineItem =
  | { type: 'comment'; id: ID; at: ISODate; actor: User | undefined; body: string; mentions: ID[] }
  | {
      type: 'event';
      id: ID;
      at: ISODate;
      actor: User | undefined;
      kind: ActivityEvent['kind'];
      changes: TimelineChange[];
    };

/** Resolve one change for display. List names are only revealed if the viewer can see that list. */
function resolveChange(data: DataWith<'statuses'>, userId: ID, change: ActivityChange): TimelineChange {
  const userName = (id: ID) => data.users[id]?.name ?? 'someone';
  switch (change.field) {
    case 'status':
      return {
        field: 'status',
        from: data.statuses[change.from]?.name ?? null,
        to: data.statuses[change.to]?.name ?? null,
      };
    case 'list': {
      const name = (id: ID) => (canViewContainer(data, userId, id) ? data.containers[id].name : null);
      return { field: 'list', from: name(change.from), to: name(change.to) };
    }
    case 'assignees':
      return { field: 'assignees', added: change.added.map(userName), removed: change.removed.map(userName) };
    default:
      return change;
  }
}

/** A task's comments and history merged into one oldest-first timeline. Callers must guard the task first. */
function timelineFor(data: DataWith<'activity' | 'comments' | 'statuses'>, userId: ID, taskId: ID): TimelineItem[] {
  const items: TimelineItem[] = [];
  for (const e of Object.values(data.activity)) {
    if (e.taskId !== taskId) continue;
    const changes = e.changes.map((c) => resolveChange(data, userId, c));
    items.push({ type: 'event', id: e.id, at: e.at, actor: data.users[e.actorId], kind: e.kind, changes });
  }
  for (const c of Object.values(data.comments)) {
    if (c.taskId === taskId) {
      items.push({
        type: 'comment',
        id: c.id,
        at: c.createdAt,
        actor: data.users[c.authorId],
        body: c.body,
        mentions: c.mentions,
      });
    }
  }
  return items.sort((a, b) => a.at.localeCompare(b.at));
}

/**
 * Everything the task drawer needs, in one permission-checked call. Breadcrumbs,
 * assignee suggestions, move targets and history are all filtered to what the user can see.
 */
export function selectTaskDetail(
  data: DataWith<'tasks' | 'statuses' | 'comments' | 'activity' | 'attachments'>,
  userId: ID,
  taskId: ID,
): Result<TaskDetail> {
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
    activity: timelineFor(data, userId, task.id),
    attachments: Object.values(data.attachments)
      .filter((a) => a.taskId === task.id)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
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

/** ⌘K search over lists the user can see; title matches rank first, then most recently updated. */
export function searchTasks(data: DataWith<'tasks' | 'statuses'>, userId: ID, query: string, limit = 20): SearchHit[] {
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

// ---------------------------------------------------------------------------
// Sprints
// ---------------------------------------------------------------------------

export interface SprintsModel {
  /** The running sprint with its live progress, or null. */
  active: { sprint: Sprint; total: number; done: number; open: number } | null;
  /** Finished sprints, newest first. */
  past: Sprint[];
}

/** A list's running sprint and its finished ones (403 if the list is hidden from the user). */
export function selectSprints(
  data: DataWith<'tasks' | 'statuses' | 'sprints'>,
  userId: ID,
  listId: ID,
): Result<SprintsModel> {
  const denied = guardViewList(data, userId, listId);
  if (denied) return { error: denied };
  const running = activeSprint(data, listId);
  return ok({
    active: running ? { sprint: running, ...sprintProgress(data, running) } : null,
    past: Object.values(data.sprints)
      .filter((s) => s.listId === listId && s.endedAt)
      .sort((a, b) => (b.endedAt ?? '').localeCompare(a.endedAt ?? '')),
  });
}

export interface SprintReportView {
  sprint: Sprint;
  report: SprintReport;
  listName: string;
  startedBy: User | undefined;
  endedBy: User | undefined;
  /** `user: null` is the unassigned bucket. */
  people: { user: User | null; done: number; spilled: number }[];
  tasks: { id: ID; title: string; assignees: User[]; status: string; outcome: 'done' | 'spilled' }[];
}

/** A finished sprint's report with people resolved to names. Same access rule as the list itself. */
export function selectSprintReport(data: DataWith<'sprints'>, userId: ID, sprintId: ID): Result<SprintReportView> {
  const sprint = data.sprints[sprintId];
  if (!sprint) return notFound('Sprint');
  const denied = guardViewList(data, userId, sprint.listId);
  if (denied) return { error: denied };
  if (!sprint.report) return fail('CONFLICT', `“${sprint.name}” is still running, so it has no report yet.`);

  const user = (id: ID) => data.users[id];
  return ok({
    sprint,
    report: sprint.report,
    listName: data.containers[sprint.listId].name,
    startedBy: user(sprint.startedBy),
    endedBy: sprint.endedBy ? user(sprint.endedBy) : undefined,
    people: sprint.report.people.map((p) => ({
      user: p.userId ? (user(p.userId) ?? null) : null,
      done: p.done,
      spilled: p.spilled,
    })),
    tasks: sprint.report.tasks.map((t) => ({
      id: t.taskId,
      title: t.title,
      assignees: t.assigneeIds.map(user).filter(Boolean),
      status: t.status,
      outcome: t.outcome,
    })),
  });
}

// ---------------------------------------------------------------------------
// Mentions
// ---------------------------------------------------------------------------

export interface MentionItem {
  commentId: ID;
  taskId: ID;
  taskTitle: string;
  listId: ID;
  listName: string;
  author: User | undefined;
  /** The start of the comment, on one line. */
  snippet: string;
  createdAt: ISODate;
  read: boolean;
}

export interface MentionsModel {
  /** Newest first. */
  items: MentionItem[];
  unread: number;
}

/**
 * Where other people have tagged this user. Only mentions on tasks the user can see right
 * now are included, so a mention can't reveal a task (or its list name) they've lost access to.
 */
export function selectMentions(data: DataWith<'tasks' | 'comments'>, userId: ID): MentionsModel {
  const items: MentionItem[] = [];
  for (const c of Object.values(data.comments)) {
    if (!c.mentions.includes(userId)) continue;
    const task = data.tasks[c.taskId];
    if (!task || guardViewList(data, userId, task.primaryListId)) continue;
    items.push({
      commentId: c.id,
      taskId: task.id,
      taskTitle: task.title,
      listId: task.primaryListId,
      listName: data.containers[task.primaryListId].name,
      author: data.users[c.authorId],
      snippet: c.body.replace(/\s+/g, ' ').slice(0, 140),
      createdAt: c.createdAt,
      read: c.readBy.includes(userId),
    });
  }
  items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { items, unread: items.filter((i) => !i.read).length };
}
