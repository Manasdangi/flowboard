import { describe, expect, it } from 'vitest';
import { createSeed, SEED_IDS } from '@/data/seed';
import {
  addAttachment,
  attachmentKind,
  guardAttachment,
  MAX_ATTACHMENTS_PER_TASK,
  removeAttachment,
} from './attachments';
import { discardUntouchedDraft } from './tasks';
import type { DataState } from './types';

const { users: U } = SEED_IDS;
const base = createSeed(new Date('2026-06-01T12:00:00Z'));
const NOW = '2026-06-01T12:00:00.000Z';
const MB = 1024 * 1024;

const file = (over: Partial<Parameters<typeof addAttachment>[2]> = {}) => ({
  id: 'att_1',
  taskId: 't_sp_1',
  name: 'mock.png',
  mime: 'image/png',
  size: 2 * MB,
  ...over,
});

/** `base` with one attachment already on t_sp_1. */
const withOne = (): DataState => addAttachment(base, U.alice, file(), NOW).data!.state;

describe('addAttachment', () => {
  it('stores the metadata for an allowed image or video', () => {
    const image = addAttachment(base, U.alice, file({ name: '  mock.png  ' }), NOW);
    expect(image.data?.value).toMatchObject({ id: 'att_1', name: 'mock.png', mime: 'image/png', createdBy: U.alice });
    expect(addAttachment(base, U.alice, file({ mime: 'video/mp4', size: 40 * MB }), NOW).data).toBeDefined();
  });

  it('rejects other file types, including SVG (it can carry script)', () => {
    for (const mime of ['image/svg+xml', 'application/pdf', 'text/html', '']) {
      expect(addAttachment(base, U.alice, file({ mime }), NOW).error?.code).toBe('VALIDATION');
    }
    expect(attachmentKind('image/svg+xml')).toBeNull();
  });

  it('enforces the size limit per kind and refuses empty files', () => {
    expect(addAttachment(base, U.alice, file({ size: 11 * MB }), NOW).error?.message).toMatch(
      /Images can be up to 10 MB/,
    );
    expect(addAttachment(base, U.alice, file({ mime: 'video/mp4', size: 51 * MB }), NOW).error?.message).toMatch(
      /Videos can be up to 50 MB/,
    );
    expect(addAttachment(base, U.alice, file({ size: 0 }), NOW).error?.message).toMatch(/empty/);
  });

  it('caps the number of attachments on one task', () => {
    let data = base;
    for (let i = 0; i < MAX_ATTACHMENTS_PER_TASK; i++) {
      data = addAttachment(data, U.alice, file({ id: `att_${i}` }), NOW).data!.state;
    }
    expect(addAttachment(data, U.alice, file({ id: 'att_extra' }), NOW).error?.code).toBe('CONFLICT');
  });

  it('returns 403 to a member who cannot see the task and 404 for a missing one', () => {
    expect(addAttachment(base, U.carol, file(), NOW).error?.code).toBe('FORBIDDEN'); // Carol is denied on Sprint 14
    expect(addAttachment(base, U.alice, file({ taskId: 't_nope' }), NOW).error?.code).toBe('NOT_FOUND');
  });
});

describe('reading and removing', () => {
  it('guardAttachment hides an attachment from someone who cannot see its task', () => {
    const data = withOne();
    expect(guardAttachment(data, U.bob, 'att_1').data?.id).toBe('att_1');
    expect(guardAttachment(data, U.carol, 'att_1').error?.code).toBe('FORBIDDEN');
    expect(guardAttachment(data, U.alice, 'att_missing').error?.code).toBe('NOT_FOUND');
  });

  it('removeAttachment drops the record, and is refused without access', () => {
    const data = withOne();
    expect(removeAttachment(data, U.carol, 'att_1').error?.code).toBe('FORBIDDEN');
    const removed = removeAttachment(data, U.bob, 'att_1').data!;
    expect(removed.value.id).toBe('att_1');
    expect(removed.state.attachments).toEqual({});
  });
});

describe('drafts', () => {
  it('a draft with an attachment (or a comment) counts as touched and is kept', () => {
    // A task created and never edited: updatedAt === createdAt.
    const task = { ...base.tasks.t_bl_1, updatedAt: base.tasks.t_bl_1.createdAt, id: 't_draft' };
    const data: DataState = { ...base, tasks: { ...base.tasks, t_draft: task } };
    expect(discardUntouchedDraft(data, U.alice, 't_draft').data?.value).toHaveLength(1);

    const withFile = addAttachment(data, U.alice, file({ taskId: 't_draft' }), NOW).data!.state;
    expect(discardUntouchedDraft(withFile, U.alice, 't_draft').data?.value).toEqual([]);
  });
});
