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
}
