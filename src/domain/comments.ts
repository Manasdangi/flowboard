/**
 * Task comments. Anyone who can see a task's list can comment on it (the same
 * rule as editing the task); everyone else gets the task's 403.
 */
import type { Change } from './containers';
import { newId } from './ids';
import { mentionedIds } from './mentions';
import { guardTask, usersWithAccess } from './permissions';
import { fail, ok } from './result';
import type { Comment, DataState, ID, ISODate, Result } from './types';

export const COMMENT_MAX = 2000;

export interface AddCommentInput {
  taskId: ID;
  body: string;
}

/** Add a comment to a task. The body is trimmed; empty or longer than COMMENT_MAX is refused. */
export function addComment(
  data: DataState,
  actorId: ID,
  input: AddCommentInput,
  now: ISODate,
): Result<Change<Comment>> {
  const found = guardTask(data, actorId, input.taskId);
  if (found.error) return found;

  const body = input.body.trim();
  if (!body) return fail('VALIDATION', 'Write something before posting a comment.');
  if (body.length > COMMENT_MAX) return fail('VALIDATION', `Comments must be ${COMMENT_MAX} characters or fewer.`);

  // Only people who can see the task can be tagged, so a mention never exposes it to anyone.
  const mentions = mentionedIds(body, usersWithAccess(data, found.data.primaryListId), actorId);
  const comment: Comment = {
    id: newId('cmt'),
    taskId: found.data.id,
    authorId: actorId,
    body,
    createdAt: now,
    mentions,
    readBy: [],
  };
  return ok({ state: { ...data, comments: { ...data.comments, [comment.id]: comment } }, value: comment });
}

/**
 * Mark mentions of this user as read: the given comments, or all of them. Only touches the
 * user's own read state, so any user may do it. Mentions on tasks they can no longer see,
 * and comments that don't mention them, are skipped. Returns how many changed.
 */
export function markMentionsRead(data: DataState, userId: ID, commentIds?: ID[]): Result<Change<number>> {
  const only = commentIds ? new Set(commentIds) : null;
  const comments = { ...data.comments };
  let changed = 0;
  for (const c of Object.values(data.comments)) {
    if (only && !only.has(c.id)) continue;
    if (!c.mentions.includes(userId) || c.readBy.includes(userId)) continue;
    if (guardTask(data, userId, c.taskId).error) continue;
    comments[c.id] = { ...c, readBy: [...c.readBy, userId] };
    changed += 1;
  }
  return ok({ state: changed ? { ...data, comments } : data, value: changed });
}
