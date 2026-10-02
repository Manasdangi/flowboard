import { describe, expect, it } from 'vitest';
import { createSeed, SEED_IDS, statusId } from '@/data/seed';
import { taskUpdatedEvent } from './activity';
import { addComment, COMMENT_MAX } from './comments';
import { selectTaskDetail } from './selectors';
import type { Task } from './types';

const { users: U, lists: L } = SEED_IDS;
const data = createSeed(new Date('2026-06-01T12:00:00Z'));
const NOW = '2026-06-01T12:00:00.000Z';

describe('addComment', () => {
  it('lets anyone who can see the task comment, and trims the body', () => {
    const result = addComment(data, U.bob, { taskId: 't_sec_2', body: '  On it  ' }, NOW);
    expect(result.data?.value).toMatchObject({ taskId: 't_sec_2', authorId: U.bob, body: 'On it', createdAt: NOW });
  });

  it('rejects empty and over-long comments', () => {
    expect(addComment(data, U.alice, { taskId: 't_sp_1', body: '   ' }, NOW).error?.code).toBe('VALIDATION');
    const long = 'a'.repeat(COMMENT_MAX + 1);
    expect(addComment(data, U.alice, { taskId: 't_sp_1', body: long }, NOW).error?.code).toBe('VALIDATION');
  });

  it('returns 403 to a member who cannot see the task', () => {
    // Carol is denied on Sprint 14.
    expect(addComment(data, U.carol, { taskId: 't_sp_1', body: 'hi' }, NOW).error?.code).toBe('FORBIDDEN');
  });
});

describe('taskUpdatedEvent', () => {
  const task = data.tasks.t_sp_1; // high priority, assigned to Bob

  it('records each field that changed', () => {
    const after: Task = { ...task, priority: 'low', assigneeIds: [U.alice], updatedAt: NOW };
    expect(taskUpdatedEvent(task, after, U.alice)).toMatchObject({
      at: NOW,
      kind: 'task.updated',
      changes: [
        { field: 'priority', from: 'high', to: 'low' },
        { field: 'assignees', added: [U.alice], removed: [U.bob] },
      ],
    });
  });

  it('ignores reorders that only change position', () => {
    expect(taskUpdatedEvent(task, { ...task, position: 99, updatedAt: NOW }, U.alice)).toBeNull();
  });

  it('records a list move without the re-mapped status', () => {
    const after: Task = { ...task, primaryListId: L.backlog, statusId: statusId(L.backlog, 'todo') };
    expect(taskUpdatedEvent(task, after, U.alice)?.changes).toEqual([{ field: 'list', from: L.sprint, to: L.backlog }]);
  });
});

describe('task timeline', () => {
  it('merges history and comments, oldest first', () => {
    const items = selectTaskDetail(data, U.alice, 't_sp_3').data!.activity;
    expect(items.map((i) => i.type)).toEqual(['event', 'event', 'event', 'comment', 'comment']);
    expect(items[0]).toMatchObject({ kind: 'task.created', actor: { id: U.alice } });
    expect(items[1]).toMatchObject({ changes: [{ field: 'status', from: 'To do', to: 'In progress' }] });
  });

  it('never reveals the name of a list the viewer cannot see', () => {
    const move = (userId: string) =>
      selectTaskDetail(data, userId, 't_bl_5').data!.activity.find(
        (i) => i.type === 'event' && i.kind === 'task.updated',
      );
    expect(move(U.alice)).toMatchObject({ changes: [{ field: 'list', from: 'Sprint 14', to: 'Backlog' }] });
    // Carol is denied on Sprint 14, so its name is withheld.
    expect(move(U.carol)).toMatchObject({ changes: [{ field: 'list', from: null, to: 'Backlog' }] });
  });

  it('returns a 403, not history or comments, for a task the viewer cannot see', () => {
    expect(selectTaskDetail(data, U.carol, 't_sp_3').error?.code).toBe('FORBIDDEN');
  });
});
