import { useMemo, useRef, useState, type ReactNode } from 'react';
import { COMMENT_MAX } from '@/domain/comments';
import { mentionSpans } from '@/domain/mentions';
import type { TimelineChange, TimelineItem } from '@/domain/selectors';
import type { ID, User } from '@/domain/types';
import { cn } from '@/lib/cn';
import { formatDay, formatRelative } from '@/lib/dates';
import { PRIORITY_STYLES } from '@/ui/tokens';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { TextArea } from '../ui/Field';
import { Kbd } from '../ui/Kbd';

/** "Bob", "Bob and Carol", "Alice, Bob and Carol". */
const joinNames = (names: string[]) =>
  names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;

/** One change as a sentence fragment, e.g. "changed status from To do to In progress". */
function describe(change: TimelineChange): string {
  switch (change.field) {
    case 'title':
      return `renamed the task from “${change.from}” to “${change.to}”`;
    case 'description':
      return 'updated the description';
    case 'status':
      return `changed status from ${change.from ?? 'a deleted status'} to ${change.to ?? 'a deleted status'}`;
    case 'list':
      return `moved the task from ${change.from ?? 'a list you can’t see'} to ${change.to ?? 'a list you can’t see'}`;
    case 'priority':
      return change.to === 'none' ? 'cleared the priority' : `set priority to ${PRIORITY_STYLES[change.to].label}`;
    case 'assignees':
      return [
        change.added.length > 0 && `assigned ${joinNames(change.added)}`,
        change.removed.length > 0 && `unassigned ${joinNames(change.removed)}`,
      ]
        .filter(Boolean)
        .join(' and ');
    case 'dueDate':
      return change.to ? `set the due date to ${formatDay(change.to)}` : 'removed the due date';
  }
}

/**
 * The task's comments and history, oldest first, with a box to add a comment.
 * Props only: the timeline arrives already permission-filtered from selectTaskDetail.
 */
export function ActivitySection({
  items,
  people,
  onComment,
}: {
  items: TimelineItem[];
  /** Who can be @-mentioned: the people who can see this task. */
  people: User[];
  /** Returns whether the comment was posted; the box is cleared only then. */
  onComment: (body: string) => boolean;
}) {
  const [body, setBody] = useState('');
  const [caret, setCaret] = useState(0);
  const [active, setActive] = useState(0);
  const [dismissed, setDismissed] = useState<number | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const submit = () => {
    if (body.trim() && onComment(body)) {
      setBody('');
      setCaret(0);
    }
  };

  // "@" just before the cursor (at the start or after a space) opens the suggestions.
  const trigger = useMemo(() => {
    const match = /(^|\s)@(\w*)$/.exec(body.slice(0, caret));
    return match ? { start: caret - match[2].length - 1, query: match[2].toLowerCase() } : null;
  }, [body, caret]);
  const options =
    trigger && trigger.start !== dismissed
      ? people.filter((p) =>
          p.name
            .toLowerCase()
            .split(/\s+/)
            .some((word) => word.startsWith(trigger.query)),
        )
      : [];
  const current = Math.min(active, options.length - 1);

  const mention = (person: User) => {
    if (!trigger) return;
    const before = body.slice(0, trigger.start);
    const position = before.length + person.name.length + 2; // "@Name " ends here
    setBody(`${before}@${person.name} ${body.slice(caret)}`);
    setCaret(position);
    setActive(0);
    requestAnimationFrame(() => {
      box.current?.focus();
      box.current?.setSelectionRange(position, position);
    });
  };

  return (
    <section className="mt-7">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-subtle">Activity</h3>
      {items.length > 0 ? (
        <ol aria-label="Task activity" className="space-y-3">
          {items.map((item) =>
            item.type === 'comment' ? (
              <li key={item.id} className="flex items-start gap-2.5">
                <ActorAvatar user={item.actor} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-ink-muted">
                    <span className="font-medium text-ink">{item.actor?.name ?? 'Someone'}</span>
                    <When at={item.at} />
                  </p>
                  <p className="mt-1 whitespace-pre-wrap break-words rounded-card bg-surface-muted px-3 py-2 text-sm text-ink ring-1 ring-inset ring-line">
                    <CommentBody body={item.body} mentions={item.mentions} people={people} />
                  </p>
                </div>
              </li>
            ) : (
              <li key={item.id} className="flex items-start gap-2.5">
                <ActorAvatar user={item.actor} />
                <p className="min-w-0 break-words pt-0.5 text-xs leading-relaxed text-ink-muted">
                  <span className="font-medium text-ink">{item.actor?.name ?? 'Someone'}</span>{' '}
                  {item.kind === 'task.created' ? 'created the task' : item.changes.map(describe).join(', ')}
                  <When at={item.at} />
                </p>
              </li>
            ),
          )}
        </ol>
      ) : (
        <p className="text-xs text-ink-subtle">No activity yet.</p>
      )}

      <form
        className="mt-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="relative">
          {options.length > 0 && (
            <ul
              role="listbox"
              aria-label="Mention suggestions"
              className="absolute bottom-full left-0 z-10 mb-1 max-h-48 w-64 overflow-y-auto rounded-card bg-surface p-1 shadow-pop"
            >
              {options.map((person, i) => (
                <li
                  key={person.id}
                  role="option"
                  aria-label={person.name}
                  aria-selected={i === current}
                  // mousedown, not click: the textarea must keep focus so the cursor position survives.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    mention(person);
                  }}
                  className={cn(
                    'flex cursor-pointer items-center gap-2 rounded-control px-2 py-1.5 text-sm text-ink',
                    i === current && 'bg-brand-50',
                  )}
                >
                  <Avatar user={person} size="xs" />
                  {person.name}
                </li>
              ))}
            </ul>
          )}
          <TextArea
            ref={box}
            aria-label="Add a comment"
            rows={3}
            value={body}
            maxLength={COMMENT_MAX}
            placeholder="Write a comment… type @ to mention someone"
            onChange={(e) => {
              setBody(e.target.value);
              setCaret(e.target.selectionStart);
              setDismissed(null);
            }}
            onSelect={(e) => setCaret(e.currentTarget.selectionStart)}
            onKeyDown={(e) => {
              if (options.length > 0) {
                if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                  e.preventDefault();
                  setActive((current + (e.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length);
                  return;
                }
                if ((e.key === 'Enter' && !e.metaKey && !e.ctrlKey) || e.key === 'Tab') {
                  e.preventDefault();
                  mention(options[current]);
                  return;
                }
                if (e.key === 'Escape') {
                  // Closes the suggestions only, not the drawer behind them.
                  e.preventDefault();
                  e.stopPropagation();
                  setDismissed(trigger?.start ?? null);
                  return;
                }
              }
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                submit();
              }
            }}
            className="resize-y"
          />
        </div>
        <div className="mt-2 flex items-center justify-end gap-3">
          <span className="flex items-center gap-1 text-2xs text-ink-subtle">
            <Kbd>⌘</Kbd>
            <Kbd>↵</Kbd> to post
          </span>
          <Button type="submit" size="sm" variant="primary" disabled={!body.trim()}>
            Comment
          </Button>
        </div>
      </form>
    </section>
  );
}

function ActorAvatar({ user }: { user: User | undefined }) {
  return user ? (
    <Avatar user={user} size="xs" className="mt-px" />
  ) : (
    <span aria-hidden className="mt-px h-5 w-5 shrink-0 rounded-full bg-surface-sunken" />
  );
}

function When({ at }: { at: string }) {
  return (
    <time dateTime={at} title={new Date(at).toLocaleString()} className="ml-1.5 text-ink-faint">
      {formatRelative(at)}
    </time>
  );
}

/** A comment's text, with the people it tagged picked out. */
function CommentBody({ body, mentions, people }: { body: string; mentions: ID[]; people: User[] }) {
  const parts: ReactNode[] = [];
  let at = 0;
  for (const span of mentionSpans(body, people)) {
    if (!mentions.includes(span.user.id)) continue;
    parts.push(body.slice(at, span.start));
    parts.push(
      <span key={span.start} className="rounded bg-brand-50 px-0.5 font-medium text-brand-700">
        {body.slice(span.start, span.end)}
      </span>,
    );
    at = span.end;
  }
  parts.push(body.slice(at));
  return <>{parts}</>;
}
