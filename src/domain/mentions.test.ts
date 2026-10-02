import { describe, expect, it } from 'vitest';
import { createSeed, SEED_IDS } from '@/data/seed';
import { addComment, markMentionsRead } from './comments';
import { mentionedIds, mentionSpans } from './mentions';
import { selectMentions, selectTaskDetail } from './selectors';
import type { DataState, User } from './types';

const { users: U, lists: L } = SEED_IDS;
const base = createSeed(new Date('2026-06-01T12:00:00Z'));
const NOW = '2026-06-01T12:00:00.000Z';
const people = Object.values(base.users);

describe('mentionSpans', () => {
  it('finds a full name, or a first name when it is unambiguous, ignoring case', () => {
    const spans = mentionSpans('Thanks @alice chen, and @Bob for the help', people);
    expect(spans.map((s) => [s.user.id, 'Thanks @alice chen, and @Bob for the help'.slice(s.start, s.end)])).toEqual([
      [U.alice, '@alice chen'],
      [U.bob, '@Bob'],
    ]);
  });

  it('prefers the longer match, so "@Alice Chen" is one mention', () => {
    expect(mentionSpans('@Alice Chen hi', people)).toHaveLength(1);
  });

  it('ignores email addresses and unknown names', () => {
    expect(mentionSpans('write to bob@Bob.com or @Zed', people)).toEqual([]);
    expect(mentionSpans('@Bobby', people)).toEqual([]); // not a whole word
  });

  it('does not guess when a first name is shared', () => {
    const second: User = { ...base.users[U.alice], id: 'u_alice2', name: 'Alice Wong' };
    const both = [...people, second];
    expect(mentionSpans('@Alice', both)).toEqual([]);
    expect(mentionSpans('@Alice Wong', both).map((s) => s.user.id)).toEqual(['u_alice2']);
  });

  it('lists each person once and leaves out the author', () => {
    expect(mentionedIds('@Bob and @Bob Martinez, also @Alice', people)).toEqual([U.bob, U.alice]);
    expect(mentionedIds('@Bob and @Alice', people, U.alice)).toEqual([U.bob]);
  });
});

describe('addComment mentions', () => {
  const post = (data: DataState, author: string, taskId: string, body: string) =>
    addComment(data, author, { taskId, body }, NOW).data!;

  it('records who was tagged, never the author', () => {
    const { value } = post(base, U.alice, 't_bl_1', '@Bob Martinez @Alice Chen please look');
    expect(value.mentions).toEqual([U.bob]);
    expect(value.readBy).toEqual([]);
  });

  it('only tags people who can see the task', () => {
    // Carol is denied on Sprint 14: tagging her there records nothing, so nothing is exposed to her.
    const { value } = post(base, U.alice, 't_sp_1', '@Carol Singh and @Bob Martinez');
    expect(value.mentions).toEqual([U.bob]);
    expect(value.body).toContain('@Carol Singh'); // the text stays; it just isn't a mention
  });
});

describe('markMentionsRead', () => {
  it('marks one mention or all of them, only for the acting user', () => {
    const one = markMentionsRead(base, U.bob, ['cmt_sp3_1']).data!;
    expect(one.value).toBe(1);
    expect(one.state.comments.cmt_sp3_1.readBy).toEqual([U.bob]);
    expect(one.state.comments.cmt_lc1_0.readBy).toEqual([]); // untouched

    const all = markMentionsRead(base, U.bob).data!;
    expect(all.value).toBe(2);
    expect(all.state.comments.cmt_lc1_0.readBy).toEqual([U.bob]);
    expect(all.state.comments.cmt_lc1_0.mentions).toEqual([U.carol, U.bob]); // Carol's own state is separate
  });

  it('is idempotent and ignores comments that do not mention the user', () => {
    const once = markMentionsRead(base, U.bob).data!.state;
    const again = markMentionsRead(once, U.bob).data!;
    expect(again.value).toBe(0);
    expect(again.state).toBe(once); // nothing changed, so the same object
    expect(markMentionsRead(base, U.carol, ['cmt_sp3_1']).data!.value).toBe(0); // not hers
  });
});

describe('selectMentions', () => {
  it('lists a user’s mentions newest first, with unread counted', () => {
    const bob = selectMentions(base, U.bob);
    expect(bob.items.map((i) => i.commentId)).toEqual(['cmt_lc1_0', 'cmt_sp3_1']);
    expect(bob.unread).toBe(2);
    expect(bob.items[0]).toMatchObject({
      taskTitle: 'Engineering blog: how we built the kanban',
      listName: 'Launch Content',
      author: { name: 'Alice Chen' },
      read: false,
    });

    const alice = selectMentions(base, U.alice);
    expect(alice.items.map((i) => i.commentId)).toEqual(['cmt_sp3_2']);
    expect(alice.unread).toBe(0); // already read
  });

  it('counts a mention as read once it is marked', () => {
    const state = markMentionsRead(base, U.bob, ['cmt_sp3_1']).data!.state;
    expect(selectMentions(state, U.bob).unread).toBe(1);
  });

  it('never shows a mention on a task the user can no longer see', () => {
    // Bob was tagged on a Sprint 14 task; once he is denied that list, the mention disappears for him.
    const denied: DataState = {
      ...base,
      grants: {
        ...base.grants,
        g_bob_sprint: { id: 'g_bob_sprint', resourceId: L.sprint, userId: U.bob, mode: 'deny' },
      },
    };
    expect(selectMentions(base, U.bob).items.some((i) => i.taskId === 't_sp_3')).toBe(true);
    expect(selectMentions(denied, U.bob).items.some((i) => i.taskId === 't_sp_3')).toBe(false);
    expect(selectMentions(denied, U.bob).unread).toBe(1);
  });

  it('drops mentions when their task is deleted', () => {
    const tasks = Object.fromEntries(Object.entries(base.tasks).filter(([id]) => id !== 't_sp_3'));
    expect(selectMentions({ ...base, tasks }, U.bob).items.some((i) => i.taskId === 't_sp_3')).toBe(false);
  });

  it('puts the mentioned ids on the task timeline so they can be highlighted', () => {
    const items = selectTaskDetail(base, U.alice, 't_sp_3').data!.activity;
    const comment = items.find((i) => i.type === 'comment' && i.id === 'cmt_sp3_1');
    expect(comment).toMatchObject({ mentions: [U.bob] });
  });
});
