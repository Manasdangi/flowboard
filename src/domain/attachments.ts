/**
 * Task attachments (images and videos). Same access rule as the task itself:
 * anyone who can see a task's list can add, view and remove its attachments.
 * Pure: the file bytes are handled by a BlobStore in the store layer.
 */
import type { Change } from './containers';
import { guardTask } from './permissions';
import { fail, notFound, ok } from './result';
import type { Attachment, DataState, ID, ISODate, Result } from './types';

const MB = 1024 * 1024;

/**
 * Allowed types and their size cap. SVG is left out on purpose: an SVG can carry
 * script, and opening one from a blob: URL would run it with the app's origin.
 */
const KINDS: Record<string, { kind: 'image' | 'video'; maxBytes: number }> = {
  'image/png': { kind: 'image', maxBytes: 10 * MB },
  'image/jpeg': { kind: 'image', maxBytes: 10 * MB },
  'image/gif': { kind: 'image', maxBytes: 10 * MB },
  'image/webp': { kind: 'image', maxBytes: 10 * MB },
  'image/avif': { kind: 'image', maxBytes: 10 * MB },
  'video/mp4': { kind: 'video', maxBytes: 50 * MB },
  'video/webm': { kind: 'video', maxBytes: 50 * MB },
  'video/ogg': { kind: 'video', maxBytes: 50 * MB },
  'video/quicktime': { kind: 'video', maxBytes: 50 * MB },
};

/** What a file picker should offer. */
export const ATTACHMENT_ACCEPT = Object.keys(KINDS).join(',');

export const MAX_ATTACHMENTS_PER_TASK = 20;

/** "image" or "video" for an allowed type, otherwise null. */
export const attachmentKind = (mime: string): 'image' | 'video' | null => KINDS[mime]?.kind ?? null;

export interface AddAttachmentInput {
  /** Chosen by the caller, so the file can be stored under it before the record is committed. */
  id: ID;
  taskId: ID;
  name: string;
  mime: string;
  size: number;
}

/** Attach a file's metadata to a task: 403/404 via the task guard, then type, size and count limits. */
export function addAttachment(
  data: DataState,
  actorId: ID,
  input: AddAttachmentInput,
  now: ISODate,
): Result<Change<Attachment>> {
  const found = guardTask(data, actorId, input.taskId);
  if (found.error) return found;

  const name = input.name.trim().slice(0, 120) || 'Untitled';
  const rule = KINDS[input.mime];
  if (!rule) return fail('VALIDATION', `“${name}” isn’t a supported file. Attach a PNG, JPEG, GIF, WebP, MP4 or WebM.`);
  if (input.size <= 0) return fail('VALIDATION', `“${name}” is empty.`);
  if (input.size > rule.maxBytes) {
    return fail(
      'VALIDATION',
      `“${name}” is too large. ${rule.kind === 'image' ? 'Images' : 'Videos'} can be up to ${rule.maxBytes / MB} MB.`,
    );
  }
  const onTask = Object.values(data.attachments).filter((a) => a.taskId === input.taskId).length;
  if (onTask >= MAX_ATTACHMENTS_PER_TASK) {
    return fail('CONFLICT', `A task can have up to ${MAX_ATTACHMENTS_PER_TASK} attachments.`);
  }

  const attachment: Attachment = {
    id: input.id,
    taskId: input.taskId,
    name,
    mime: input.mime,
    size: input.size,
    createdBy: actorId,
    createdAt: now,
  };
  return ok({
    state: { ...data, attachments: { ...data.attachments, [attachment.id]: attachment } },
    value: attachment,
  });
}

/** An attachment, if its task is visible to the user. Gate every read of the file's bytes with this. */
export function guardAttachment(data: DataState, userId: ID, attachmentId: ID): Result<Attachment> {
  const attachment = data.attachments[attachmentId];
  if (!attachment) return notFound('Attachment');
  const task = guardTask(data, userId, attachment.taskId);
  return task.error ? task : ok(attachment);
}

/** Remove an attachment's record; the store then deletes its stored file. */
export function removeAttachment(data: DataState, actorId: ID, attachmentId: ID): Result<Change<Attachment>> {
  const found = guardAttachment(data, actorId, attachmentId);
  if (found.error) return found;
  const attachments = { ...data.attachments };
  delete attachments[attachmentId];
  return ok({ state: { ...data, attachments }, value: found.data });
}
