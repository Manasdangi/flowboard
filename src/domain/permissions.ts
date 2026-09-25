/**
 * Permission engine. Pure functions over DataState — every store selector and
 * mutation calls into here, so the UI can never show or change something the
 * current user isn't allowed to (hiding buttons is just a courtesy on top).
 *
 * Resolution for a member looking at container N (admins always pass):
 *   1. An explicit grant for (N, user) decides: allow → visible, deny → hidden.
 *   2. Otherwise, if N is private → hidden.
 *   3. Otherwise (public) → inherit the decision of N's parent.
 *   The workspace root is visible to every member.
 *
 * So "the nearest explicit decision wins", private acts as a barrier, and an
 * explicit allow deep in the tree works even under a private/denied ancestor
 * (the ancestors are then shown as restricted path-only nodes in the tree).
 */
import { forbidden, notFound, ok } from './result';
import type { Container, DataState, Grant, ID, Result, StoreError, Task, User } from './types';

export type AccessDecision = {
  visible: boolean;
  /** Why — shown in the share dialog so the model is explainable. */
  reason: 'admin' | 'workspace' | 'grant-allow' | 'grant-deny' | 'private';
  /** The container whose rule produced the decision (≠ the node itself when inherited). */
  decidedBy: ID;
};

const isAdmin = (user: User | undefined): boolean => user?.role === 'admin';

export function findGrant(data: DataState, userId: ID, resourceId: ID): Grant | undefined {
  for (const grant of Object.values(data.grants)) {
    if (grant.userId === userId && grant.resourceId === resourceId) return grant;
  }
  return undefined;
}

/** True when the container or any ancestor has been archived (soft-deleted). */
export function isArchivedPath(data: DataState, containerId: ID): boolean {
  let node: Container | undefined = data.containers[containerId];
  while (node) {
    if (node.archivedAt) return true;
    node = node.parentId ? data.containers[node.parentId] : undefined;
  }
  return false;
}

/** Access decision ignoring archive state. */
export function resolveAccess(data: DataState, userId: ID, containerId: ID): AccessDecision {
  const user = data.users[userId];
  const node = data.containers[containerId];
  if (!user || !node) return { visible: false, reason: 'private', decidedBy: containerId };
  if (isAdmin(user)) return { visible: true, reason: 'admin', decidedBy: containerId };
  return resolveMember(data, userId, node);
}

function resolveMember(data: DataState, userId: ID, node: Container): AccessDecision {
  if (node.type === 'workspace') return { visible: true, reason: 'workspace', decidedBy: node.id };

  const grant = findGrant(data, userId, node.id);
  if (grant) {
    return grant.mode === 'allow'
      ? { visible: true, reason: 'grant-allow', decidedBy: node.id }
      : { visible: false, reason: 'grant-deny', decidedBy: node.id };
  }
  if (node.visibility === 'private') return { visible: false, reason: 'private', decidedBy: node.id };

  const parent = node.parentId ? data.containers[node.parentId] : undefined;
  if (!parent) return { visible: true, reason: 'workspace', decidedBy: node.id };
  // Inherit the parent's decision; `decidedBy` still points at the container whose rule applied.
  return resolveMember(data, userId, parent);
}

/** Can the user see (open) this container? Archived containers are never viewable. */
export function canViewContainer(data: DataState, userId: ID, containerId: ID): boolean {
  if (!data.containers[containerId] || isArchivedPath(data, containerId)) return false;
  return resolveAccess(data, userId, containerId).visible;
}

/** Container CRUD, reorder, visibility and sharing are admin-only. */
function canManageContainers(data: DataState, userId: ID): boolean {
  return isAdmin(data.users[userId]);
}

// Members may edit tasks in any list they can see — task mutations use guardViewList / guardTask.

/** Users who can see a list — used to scope the assignee picker. */
export function usersWithAccess(data: DataState, listId: ID): User[] {
  return Object.values(data.users).filter((u) => canViewContainer(data, u.id, listId));
}

// ---------------------------------------------------------------------------
// Guards: return a StoreError (403 / 404) or null. Used by selectors & mutations.
// ---------------------------------------------------------------------------

export function guardViewList(data: DataState, userId: ID, listId: ID): StoreError | null {
  const list = data.containers[listId];
  if (!list || list.type !== 'list') return notFound('List').error!;
  if (isArchivedPath(data, listId)) return { code: 'NOT_FOUND', message: `"${list.name}" has been archived.` };
  if (!resolveAccess(data, userId, listId).visible) {
    return forbidden("You don't have access to this list. Ask a workspace admin to share it with you.").error!;
  }
  return null;
}

export function guardTask(data: DataState, userId: ID, taskId: ID): Result<Task> {
  const task = data.tasks[taskId];
  if (!task) return notFound('Task');
  const err = guardViewList(data, userId, task.primaryListId);
  if (err) {
    return err.code === 'FORBIDDEN' ? forbidden("You don't have access to this task's list.") : { error: err };
  }
  return ok(task);
}

export function guardManage(data: DataState, userId: ID, action: string): StoreError | null {
  return canManageContainers(data, userId) ? null : forbidden(`Only workspace admins can ${action}.`).error!;
}
