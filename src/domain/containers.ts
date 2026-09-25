/**
 * Container mutations. Pure: (state, actorId, input, now) → Result<Change>.
 * Container structure is admin-only; every function re-checks that itself.
 */
import { newId } from './ids';
import { moveId, nextPosition, reindex } from './ordering';
import { guardManage } from './permissions';
import { fail, notFound, ok } from './result';
import { defaultStatuses } from './statuses';
import { CHILD_TYPE, childrenOf } from './tree';
import type { Container, DataState, GrantMode, ID, ISODate, Result, Visibility } from './types';

export interface Change<T = void> {
  state: DataState;
  value: T;
}

const NAME_MAX = 80;

function validateName(name: string): Result<string> {
  const trimmed = name.trim();
  if (!trimmed) return fail('VALIDATION', 'Name is required.');
  if (trimmed.length > NAME_MAX) return fail('VALIDATION', `Name must be ${NAME_MAX} characters or fewer.`);
  return ok(trimmed);
}

function getContainer(data: DataState, id: ID): Result<Container> {
  const c = data.containers[id];
  return c ? ok(c) : notFound('Container');
}

export interface CreateContainerInput {
  parentId: ID;
  name: string;
  visibility?: Visibility;
}

export function createContainer(
  data: DataState,
  actorId: ID,
  input: CreateContainerInput,
  now: ISODate,
): Result<Change<Container>> {
  const denied = guardManage(data, actorId, 'create spaces, folders or lists');
  if (denied) return { error: denied };

  const parent = getContainer(data, input.parentId);
  if (parent.error) return parent;
  if (parent.data.archivedAt) return fail('CONFLICT', 'Cannot add items to an archived container.');

  const type = CHILD_TYPE[parent.data.type];
  if (!type) return fail('VALIDATION', 'Lists hold tasks, not other containers.');

  const name = validateName(input.name);
  if (name.error) return name;

  const container: Container = {
    id: newId(type),
    name: name.data,
    type,
    parentId: parent.data.id,
    position: nextPosition(childrenOf(data, parent.data.id, { includeArchived: true })),
    visibility: input.visibility ?? 'public',
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  let statuses = data.statuses;
  if (type === 'list') {
    statuses = { ...statuses };
    for (const s of defaultStatuses(container.id)) statuses[s.id] = s;
  }

  return ok({
    state: { ...data, containers: { ...data.containers, [container.id]: container }, statuses },
    value: container,
  });
}

function patchContainer(
  data: DataState,
  actorId: ID,
  id: ID,
  action: string,
  patch: (c: Container) => Result<Partial<Container>>,
  now: ISODate,
): Result<Change<Container>> {
  const denied = guardManage(data, actorId, action);
  if (denied) return { error: denied };
  const found = getContainer(data, id);
  if (found.error) return found;
  const changes = patch(found.data);
  if (changes.error) return changes;
  const next = { ...found.data, ...changes.data, updatedAt: now };
  return ok({ state: { ...data, containers: { ...data.containers, [id]: next } }, value: next });
}

export function renameContainer(data: DataState, actorId: ID, id: ID, name: string, now: ISODate) {
  return patchContainer(
    data,
    actorId,
    id,
    'rename containers',
    () => {
      const valid = validateName(name);
      return valid.error ? valid : ok({ name: valid.data });
    },
    now,
  );
}

export function setVisibility(data: DataState, actorId: ID, id: ID, visibility: Visibility, now: ISODate) {
  return patchContainer(
    data,
    actorId,
    id,
    'change visibility',
    (c) =>
      c.type === 'workspace' ? fail('VALIDATION', 'The workspace is always visible to members.') : ok({ visibility }),
    now,
  );
}

/** Soft delete: the subtree disappears from every selector but stays restorable. */
export function archiveContainer(data: DataState, actorId: ID, id: ID, now: ISODate) {
  return patchContainer(
    data,
    actorId,
    id,
    'archive containers',
    (c) => {
      if (c.type === 'workspace') return fail('VALIDATION', 'The workspace cannot be archived.');
      if (c.archivedAt) return fail('CONFLICT', `"${c.name}" is already archived.`);
      return ok({ archivedAt: now });
    },
    now,
  );
}

export function restoreContainer(data: DataState, actorId: ID, id: ID, now: ISODate) {
  return patchContainer(
    data,
    actorId,
    id,
    'restore containers',
    (c) => {
      if (!c.archivedAt) return fail('CONFLICT', `"${c.name}" is not archived.`);
      const parent = c.parentId ? data.containers[c.parentId] : undefined;
      if (parent?.archivedAt) return fail('CONFLICT', `Restore "${parent.name}" first.`);
      return ok({ archivedAt: null });
    },
    now,
  );
}

/** Move a container to `toIndex` among its (non-archived) siblings. */
export function reorderContainer(data: DataState, actorId: ID, id: ID, toIndex: number, now: ISODate): Result<Change> {
  const denied = guardManage(data, actorId, 'reorder containers');
  if (denied) return { error: denied };
  const found = getContainer(data, id);
  if (found.error) return found;
  if (!found.data.parentId) return fail('VALIDATION', 'The workspace cannot be reordered.');

  const siblings = childrenOf(data, found.data.parentId).map((c) => c.id);
  const positions = reindex(moveId(siblings, id, toIndex));
  const containers = { ...data.containers };
  for (const [cid, position] of positions) {
    if (containers[cid].position !== position) containers[cid] = { ...containers[cid], position, updatedAt: now };
  }
  return ok({ state: { ...data, containers }, value: undefined });
}

/** Set (or clear, with `mode: null`) a user's grant on a space / folder / list. */
export function setGrant(
  data: DataState,
  actorId: ID,
  input: { resourceId: ID; userId: ID; mode: GrantMode | null },
): Result<Change> {
  const denied = guardManage(data, actorId, 'change sharing');
  if (denied) return { error: denied };
  const resource = getContainer(data, input.resourceId);
  if (resource.error) return resource;
  if (resource.data.type === 'workspace') return fail('VALIDATION', 'Grants attach to spaces, folders or lists.');
  if (!data.users[input.userId]) return notFound('User');

  const grants = { ...data.grants };
  for (const g of Object.values(grants)) {
    if (g.resourceId === input.resourceId && g.userId === input.userId) delete grants[g.id];
  }
  if (input.mode) {
    const id = `grant_${input.resourceId}_${input.userId}`;
    grants[id] = { id, resourceId: input.resourceId, userId: input.userId, mode: input.mode };
  }
  return ok({ state: { ...data, grants }, value: undefined });
}
