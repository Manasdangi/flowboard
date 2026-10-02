export type ID = string;
/** ISO-8601 datetime string. */
export type ISODate = string;

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export type Role = 'admin' | 'member';

export type AvatarColor = 'violet' | 'sky' | 'amber' | 'emerald' | 'rose';

export interface User {
  id: ID;
  name: string;
  email: string;
  role: Role;
  title: string;
  avatarColor: AvatarColor;
}

// ---------------------------------------------------------------------------
// Containers (Workspace → Space → Folder → List)
// ---------------------------------------------------------------------------

export type ContainerType = 'workspace' | 'space' | 'folder' | 'list';

/**
 * public  → visible to every workspace member unless explicitly denied.
 * private → visible only with an explicit `allow` grant (admins bypass).
 */
export type Visibility = 'public' | 'private';

export interface Container {
  id: ID;
  name: string;
  type: ContainerType;
  parentId: ID | null;
  /** Sibling ordering. Integers spaced by POSITION_STEP; re-indexed on reorder. */
  position: number;
  visibility: Visibility;
  /** Soft delete. Archived containers (and everything under them) disappear from selectors. */
  archivedAt: ISODate | null;
  createdAt: ISODate;
  updatedAt: ISODate;
}

// ---------------------------------------------------------------------------
// Statuses (owned by a list)
// ---------------------------------------------------------------------------

export type StatusCategory = 'todo' | 'in_progress' | 'done';

export type StatusColor = 'slate' | 'blue' | 'violet' | 'amber' | 'emerald' | 'rose';

export interface Status {
  id: ID;
  listId: ID;
  name: string;
  category: StatusCategory;
  color: StatusColor;
  position: number;
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export type Priority = 'urgent' | 'high' | 'normal' | 'low' | 'none';

export interface Task {
  id: ID;
  title: string;
  description: string;
  primaryListId: ID;
  statusId: ID;
  priority: Priority;
  assigneeIds: ID[];
  dueDate: ISODate | null;
  /** Order within its status column (top-level tasks) or within its parent (subtasks). */
  position: number;
  /** One level of subtasks: a subtask's parent is always a top-level task. */
  parentTaskId: ID | null;
  createdBy: ID;
  createdAt: ISODate;
  updatedAt: ISODate;
}

// ---------------------------------------------------------------------------
// Sprints
// ---------------------------------------------------------------------------

/** One task's outcome when a sprint ended. A snapshot, so the report never changes after the fact. */
export interface SprintTaskResult {
  taskId: ID;
  title: string;
  assigneeIds: ID[];
  /** The status name when the sprint ended. */
  status: string;
  outcome: 'done' | 'spilled';
}

/** One person's tally. `userId: null` collects tasks nobody was assigned to. */
export interface SprintPersonResult {
  userId: ID | null;
  done: number;
  spilled: number;
}

export interface SprintReport {
  total: number;
  done: number;
  /** Open at the end: they stay in the list for the next sprint. */
  spilled: number;
  /** A task with several assignees counts once for each of them. */
  people: SprintPersonResult[];
  tasks: SprintTaskResult[];
}

/** A time-boxed run of work on one list. Only one can be running per list. */
export interface Sprint {
  id: ID;
  listId: ID;
  name: string;
  startedAt: ISODate;
  /** The planned last day, if one was set. */
  endsOn: ISODate | null;
  startedBy: ID;
  /** The top-level tasks that were still open when it started. Tasks created later join automatically. */
  taskIds: ID[];
  endedAt: ISODate | null;
  endedBy: ID | null;
  /** Filled in when the sprint ends. */
  report: SprintReport | null;
}

// ---------------------------------------------------------------------------
// Attachments
// ---------------------------------------------------------------------------

/** An image or video on a task. Only this metadata is in DataState; the file's bytes live in a BlobStore. */
export interface Attachment {
  id: ID;
  taskId: ID;
  /** The original file name, shown as text only. */
  name: string;
  /** One of the types allowed by `addAttachment`. */
  mime: string;
  /** Bytes. */
  size: number;
  createdBy: ID;
  createdAt: ISODate;
}

// ---------------------------------------------------------------------------
// Comments & activity
// ---------------------------------------------------------------------------

export interface Comment {
  id: ID;
  taskId: ID;
  authorId: ID;
  /** Plain text. */
  body: string;
  createdAt: ISODate;
  /** People @-mentioned in the body who can see the task. Never the author. */
  mentions: ID[];
  /** The mentioned people who have read it. */
  readBy: ID[];
}

/** One field that changed in a task edit. Ids are stored; names are resolved when read. */
export type ActivityChange =
  | { field: 'title'; from: string; to: string }
  | { field: 'description' }
  | { field: 'status'; from: ID; to: ID }
  | { field: 'priority'; from: Priority; to: Priority }
  | { field: 'assignees'; added: ID[]; removed: ID[] }
  | { field: 'dueDate'; from: ISODate | null; to: ISODate | null }
  | { field: 'list'; from: ID; to: ID };

export interface ActivityEvent {
  id: ID;
  at: ISODate;
  actorId: ID;
  taskId: ID;
  kind: 'task.created' | 'task.updated';
  /** Empty for `task.created`. */
  changes: ActivityChange[];
}

// ---------------------------------------------------------------------------
// Permissions
// ---------------------------------------------------------------------------

export type GrantMode = 'allow' | 'deny';

export interface Grant {
  id: ID;
  /** A space, folder or list id. */
  resourceId: ID;
  userId: ID;
  mode: GrantMode;
}

// ---------------------------------------------------------------------------
// Store contract
// ---------------------------------------------------------------------------

export type ErrorCode = 'FORBIDDEN' | 'NOT_FOUND' | 'VALIDATION' | 'CONFLICT' | 'NETWORK';

export interface StoreError {
  code: ErrorCode;
  message: string;
}

/** Every store query / mutation resolves to this shape — `{ data }` or `{ error: { code, message } }`. */
export type Result<T> = { data: T; error?: undefined } | { data?: undefined; error: StoreError };

/** The normalized, persistable data graph (our stand-in for API + DB). */
export interface DataState {
  workspaceId: ID;
  users: Record<ID, User>;
  containers: Record<ID, Container>;
  statuses: Record<ID, Status>;
  tasks: Record<ID, Task>;
  grants: Record<ID, Grant>;
  comments: Record<ID, Comment>;
  attachments: Record<ID, Attachment>;
  sprints: Record<ID, Sprint>;
  /** Task history, oldest dropped past ACTIVITY_MAX. Recorded by the store, not by domain mutations. */
  activity: Record<ID, ActivityEvent>;
}

/** The slices every permission and tree check reads. */
export type AccessData = Pick<DataState, 'workspaceId' | 'users' | 'containers' | 'grants'>;

/**
 * AccessData plus the named slices. Read functions take this instead of the whole
 * DataState, so a component can subscribe to just the slices it needs and a change
 * to anything else (a comment, an attachment) doesn't re-run it.
 */
export type DataWith<K extends keyof DataState> = AccessData & Pick<DataState, K>;
