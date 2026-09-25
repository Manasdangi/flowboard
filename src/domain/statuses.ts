import { newId } from './ids';
import { byPosition, nextPosition } from './ordering';
import { guardManage } from './permissions';
import { fail, notFound, ok } from './result';
import type { DataState, ID, Result, Status, StatusCategory, StatusColor } from './types';
import type { Change } from './containers';

export const CATEGORY_LABEL: Record<StatusCategory, string> = {
  todo: 'Not started',
  in_progress: 'Active',
  done: 'Completed',
};

export function defaultStatuses(listId: ID): Status[] {
  return [
    { id: newId('st'), listId, name: 'To do', category: 'todo', color: 'slate', position: 1000 },
    { id: newId('st'), listId, name: 'In progress', category: 'in_progress', color: 'blue', position: 2000 },
    { id: newId('st'), listId, name: 'Done', category: 'done', color: 'emerald', position: 3000 },
  ];
}

export function statusesForList(data: DataState, listId: ID): Status[] {
  return Object.values(data.statuses)
    .filter((s) => s.listId === listId)
    .sort(byPosition);
}

/**
 * When a task moves between lists its status must be re-mapped onto the
 * target list's status set: same name → same category → first status.
 */
export function mapStatusToList(data: DataState, statusId: ID, targetListId: ID): Status | undefined {
  const target = statusesForList(data, targetListId);
  const source = data.statuses[statusId];
  if (!source) return target[0];
  return (
    target.find((s) => s.name.toLowerCase() === source.name.toLowerCase()) ??
    target.find((s) => s.category === source.category) ??
    target[0]
  );
}

export interface StatusInput {
  name: string;
  category: StatusCategory;
  color: StatusColor;
}

function validateStatus(data: DataState, listId: ID, input: StatusInput, ignoreId?: ID): Result<string> {
  const name = input.name.trim();
  if (!name) return fail('VALIDATION', 'Status name is required.');
  if (name.length > 40) return fail('VALIDATION', 'Status name must be 40 characters or fewer.');
  const clash = statusesForList(data, listId).some(
    (s) => s.id !== ignoreId && s.name.toLowerCase() === name.toLowerCase(),
  );
  if (clash) return fail('CONFLICT', `A status named "${name}" already exists on this list.`);
  return ok(name);
}

export function addStatus(data: DataState, actorId: ID, listId: ID, input: StatusInput): Result<Change<Status>> {
  const denied = guardManage(data, actorId, 'configure statuses');
  if (denied) return { error: denied };
  if (data.containers[listId]?.type !== 'list') return notFound('List');
  const name = validateStatus(data, listId, input);
  if (name.error) return name;
  const status: Status = {
    id: newId('st'),
    listId,
    name: name.data,
    category: input.category,
    color: input.color,
    position: nextPosition(statusesForList(data, listId)),
  };
  return ok({ state: { ...data, statuses: { ...data.statuses, [status.id]: status } }, value: status });
}

export function updateStatus(data: DataState, actorId: ID, statusId: ID, input: StatusInput): Result<Change<Status>> {
  const denied = guardManage(data, actorId, 'configure statuses');
  if (denied) return { error: denied };
  const existing = data.statuses[statusId];
  if (!existing) return notFound('Status');
  const name = validateStatus(data, existing.listId, input, statusId);
  if (name.error) return name;
  const others = statusesForList(data, existing.listId).filter((s) => s.id !== statusId);
  if (input.category !== existing.category && !others.some((s) => s.category === existing.category)) {
    return fail('VALIDATION', `A list needs at least one "${CATEGORY_LABEL[existing.category]}" status.`);
  }
  const status = { ...existing, name: name.data, category: input.category, color: input.color };
  return ok({ state: { ...data, statuses: { ...data.statuses, [statusId]: status } }, value: status });
}

/** Deleting a status in use is refused (CONFLICT) rather than silently re-mapping tasks. */
export function deleteStatus(data: DataState, actorId: ID, statusId: ID): Result<Change> {
  const denied = guardManage(data, actorId, 'configure statuses');
  if (denied) return { error: denied };
  const existing = data.statuses[statusId];
  if (!existing) return notFound('Status');
  const inUse = Object.values(data.tasks).filter((t) => t.statusId === statusId).length;
  if (inUse > 0) {
    return fail('CONFLICT', `"${existing.name}" is used by ${inUse} task${inUse === 1 ? '' : 's'}. Move them first.`);
  }
  const others = statusesForList(data, existing.listId).filter((s) => s.id !== statusId);
  if (!others.some((s) => s.category === existing.category)) {
    return fail('VALIDATION', `A list needs at least one "${CATEGORY_LABEL[existing.category]}" status.`);
  }
  const statuses = { ...data.statuses };
  delete statuses[statusId];
  return ok({ state: { ...data, statuses }, value: undefined });
}
