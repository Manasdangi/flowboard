/**
 * Task history. The store records an event after each successful task create /
 * update / move, using the builders here, so the task mutations themselves stay
 * unaware of the feed. Pure: events are stamped with the task's own timestamps.
 */
import { newId } from './ids';
import type { ActivityChange, ActivityEvent, DataState, ID, Task } from './types';

/** Older events are dropped past this, so localStorage stays small. */
const ACTIVITY_MAX = 500;

/** The "created the task" event, stamped with the task's createdAt. */
export function taskCreatedEvent(task: Task, actorId: ID): ActivityEvent {
  return { id: newId('act'), at: task.createdAt, actorId, taskId: task.id, kind: 'task.created', changes: [] };
}

/** Fields that differ between two versions of a task. Position-only changes (reorders) aren't history. */
function diffTask(before: Task, after: Task): ActivityChange[] {
  const changes: ActivityChange[] = [];
  if (before.title !== after.title) changes.push({ field: 'title', from: before.title, to: after.title });
  if (before.description !== after.description) changes.push({ field: 'description' });
  if (before.primaryListId !== after.primaryListId) {
    // Changing list also re-maps the status; the move is what matters, and the
    // two statuses belong to different lists, so only the list is recorded.
    changes.push({ field: 'list', from: before.primaryListId, to: after.primaryListId });
  } else if (before.statusId !== after.statusId) {
    changes.push({ field: 'status', from: before.statusId, to: after.statusId });
  }
  if (before.priority !== after.priority)
    changes.push({ field: 'priority', from: before.priority, to: after.priority });
  const added = after.assigneeIds.filter((id) => !before.assigneeIds.includes(id));
  const removed = before.assigneeIds.filter((id) => !after.assigneeIds.includes(id));
  if (added.length || removed.length) changes.push({ field: 'assignees', added, removed });
  if (before.dueDate !== after.dueDate) changes.push({ field: 'dueDate', from: before.dueDate, to: after.dueDate });
  return changes;
}

/** An "updated" event for an edit or move, or null when nothing worth recording changed. */
export function taskUpdatedEvent(before: Task | undefined, after: Task, actorId: ID): ActivityEvent | null {
  if (!before) return null;
  const changes = diffTask(before, after);
  if (changes.length === 0) return null;
  return { id: newId('act'), at: after.updatedAt, actorId, taskId: after.id, kind: 'task.updated', changes };
}

/** Add an event, dropping the oldest ones past ACTIVITY_MAX. */
export function appendActivity(data: DataState, event: ActivityEvent): DataState {
  const activity = { ...data.activity, [event.id]: event };
  const ids = Object.keys(activity);
  if (ids.length > ACTIVITY_MAX) {
    ids.sort((a, b) => activity[a].at.localeCompare(activity[b].at));
    for (const id of ids.slice(0, ids.length - ACTIVITY_MAX)) delete activity[id];
  }
  return { ...data, activity };
}
