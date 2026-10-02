/**
 * @-mentions in comments. A mention is plain text, "@Alice Chen" (or just "@Alice" when
 * only one candidate has that first name). The same scan decides who is notified when a
 * comment is saved and which words are highlighted when it is shown, so the two can't disagree.
 */
import type { ID, User } from './types';

export interface MentionSpan {
  start: number;
  end: number;
  user: User;
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Where each candidate is mentioned in `body`, left to right. `@` must start a word, so an
 * email address never counts, and when two matches overlap the longer one wins ("@Alice Chen"
 * beats "@Alice").
 */
export function mentionSpans(body: string, candidates: User[]): MentionSpan[] {
  const byFirstName = new Map<string, number>();
  for (const u of candidates) {
    const first = u.name.split(/\s+/)[0].toLowerCase();
    byFirstName.set(first, (byFirstName.get(first) ?? 0) + 1);
  }

  const found: MentionSpan[] = [];
  for (const user of candidates) {
    const first = user.name.split(/\s+/)[0];
    const handles = [user.name];
    // A bare first name is only a mention when it can't mean anyone else.
    if (first !== user.name && byFirstName.get(first.toLowerCase()) === 1) handles.push(first);
    for (const handle of handles) {
      const pattern = new RegExp(`(^|[^\\w@])@${escapeRegExp(handle)}(?!\\w)`, 'gi');
      for (const match of body.matchAll(pattern)) {
        const start = match.index + match[1].length;
        found.push({ start, end: start + 1 + handle.length, user });
      }
    }
  }

  found.sort((a, b) => a.start - b.start || b.end - a.end);
  const spans: MentionSpan[] = [];
  for (const span of found) {
    if (span.start >= (spans.at(-1)?.end ?? 0)) spans.push(span);
  }
  return spans;
}

/** The people mentioned in `body`, without repeats and without `exclude` (you don't notify yourself). */
export function mentionedIds(body: string, candidates: User[], exclude?: ID): ID[] {
  return [...new Set(mentionSpans(body, candidates).map((s) => s.user.id))].filter((id) => id !== exclude);
}
