import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react';
import { AtSign } from 'lucide-react';
import { useMemo } from 'react';
import { selectMentions, type MentionItem } from '@/domain/selectors';
import { cn } from '@/lib/cn';
import { formatRelative } from '@/lib/dates';
import { navigate } from '@/lib/router';
import { useActions, useAppStore, useDataWith } from '@/store/hooks';
import { FOCUS_RING } from '@/ui/tokens';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';

/**
 * The current member's inbox of @-mentions: who tagged them, on which task, and whether they
 * have read it. Each member sees their own, so switching users switches the list. Clicking one
 * opens its task and marks it read.
 */
export function MentionsMenu() {
  const data = useDataWith('tasks', 'comments');
  const userId = useAppStore((s) => s.currentUserId);
  const { markMentionsRead } = useActions();
  const { items, unread } = useMemo(() => selectMentions(data, userId), [data, userId]);
  const label = unread > 0 ? `Mentions, ${unread} unread` : 'Mentions';

  return (
    <Popover className="relative">
      <PopoverButton
        aria-label={label}
        title="Where people have tagged you"
        data-testid="mentions-button"
        className={cn(
          'relative flex h-9 w-9 items-center justify-center rounded-full bg-surface text-ink-muted shadow-card transition-shadow hover:text-ink hover:shadow-card-hover data-[open]:text-ink data-[open]:shadow-card-hover',
          FOCUS_RING,
        )}
      >
        <AtSign className="h-4 w-4" aria-hidden />
        {unread > 0 && (
          <span
            aria-hidden
            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-surface"
          >
            {unread}
          </span>
        )}
      </PopoverButton>

      <PopoverPanel
        anchor={{ to: 'bottom end', gap: 8 }}
        className="z-50 w-[26rem] animate-pop-in overflow-hidden rounded-panel bg-surface shadow-pop"
      >
        {({ close }) => (
          <>
            <div className="flex items-center gap-2 border-b border-line px-4 py-3">
              <h2 className="flex-1 text-sm font-semibold text-ink">Mentions</h2>
              <Button size="sm" variant="ghost" disabled={unread === 0} onClick={() => markMentionsRead()}>
                Mark all as read
              </Button>
            </div>
            {items.length === 0 ? (
              <p className="px-4 py-10 text-center text-xs text-ink-subtle">
                No one has mentioned you yet. When someone types your name after an @ in a comment, it shows up here.
              </p>
            ) : (
              <ul aria-label="Your mentions" className="max-h-96 divide-y divide-line overflow-y-auto">
                {items.map((item) => (
                  <MentionRow
                    key={item.commentId}
                    item={item}
                    onOpen={() => {
                      markMentionsRead([item.commentId]);
                      navigate({ listId: item.listId, taskId: item.taskId });
                      close();
                    }}
                  />
                ))}
              </ul>
            )}
          </>
        )}
      </PopoverPanel>
    </Popover>
  );
}

function MentionRow({ item, onOpen }: { item: MentionItem; onOpen: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-muted',
          !item.read && 'bg-brand-50/50',
          FOCUS_RING,
        )}
      >
        {item.author ? (
          <Avatar user={item.author} size="md" />
        ) : (
          <span aria-hidden className="h-7 w-7 shrink-0 rounded-full bg-surface-sunken" />
        )}
        <span className="min-w-0 flex-1">
          <span className="block text-sm text-ink-muted">
            <span className="font-medium text-ink">{item.author?.name ?? 'Someone'}</span> mentioned you in{' '}
            <span className="font-medium text-ink">{item.taskTitle}</span>
          </span>
          <span className="mt-0.5 block text-2xs text-ink-subtle">
            {item.listName} · {formatRelative(item.createdAt)}
          </span>
          <span className="mt-1 line-clamp-2 block text-xs text-ink-muted">“{item.snippet}”</span>
        </span>
        {!item.read && <span aria-label="Unread" className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500" />}
      </button>
    </li>
  );
}
