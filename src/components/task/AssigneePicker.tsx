import { Combobox, ComboboxInput, ComboboxOption, ComboboxOptions } from '@headlessui/react';
import { X } from 'lucide-react';
import { useRef, useState } from 'react';
import type { ID, User } from '@/domain/types';
import { cn } from '@/lib/cn';
import { Avatar } from '../ui/Avatar';

const matches = (user: User, query: string) => {
  const q = query.trim().toLowerCase();
  return (
    !q ||
    user.name.toLowerCase().includes(q) ||
    user.email.toLowerCase().includes(q) ||
    user.title.toLowerCase().includes(q)
  );
};

/**
 * Multi-assignee field. Each assignee is a removable chip; typing searches the
 * people who can see this list (the store scopes `candidates`) and picking one
 * adds them. Backspace on an empty search removes the last chip.
 */
export function AssigneePicker({
  assigneeIds,
  candidates,
  users,
  onChange,
}: {
  assigneeIds: ID[];
  /** Users allowed to be assigned (they can see the list). */
  candidates: User[];
  /** All users, to render chips for existing assignees. */
  users: Record<ID, User>;
  onChange: (ids: ID[]) => void;
}) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const assignees = assigneeIds.map((id) => users[id]).filter(Boolean);
  const canSeeList = (id: ID) => candidates.some((u) => u.id === id);
  const suggestions = candidates.filter((u) => !assigneeIds.includes(u.id) && matches(u, query));

  const add = (user: User | null) => {
    if (!user) return;
    onChange([...assigneeIds, user.id]);
    setQuery('');
  };
  const remove = (id: ID) => onChange(assigneeIds.filter((x) => x !== id));

  return (
    <Combobox value={null} onChange={add} immediate>
      <div
        onClick={() => inputRef.current?.focus()}
        className="flex min-h-8 w-full cursor-text flex-wrap items-center gap-1 rounded-control bg-surface p-1 ring-1 ring-inset ring-line-strong transition-shadow focus-within:ring-2 focus-within:ring-brand-500 hover:ring-ink-faint"
      >
        {assignees.map((user) => (
          <span
            key={user.id}
            data-testid="assignee-chip"
            title={canSeeList(user.id) ? user.email : `${user.name} can no longer see this list`}
            className={cn(
              'inline-flex h-6 items-center gap-1 rounded-full py-0.5 pl-0.5 pr-1 text-xs font-medium',
              canSeeList(user.id) ? 'bg-brand-50 text-brand-800' : 'bg-surface-sunken text-ink-subtle line-through',
            )}
          >
            <Avatar user={user} size="xs" />
            {user.name}
            <button
              type="button"
              aria-label={`Unassign ${user.name}`}
              onClick={(e) => {
                e.stopPropagation();
                remove(user.id);
              }}
              className="flex h-4 w-4 items-center justify-center rounded-full opacity-60 hover:bg-brand-100 hover:opacity-100"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <ComboboxInput
          ref={inputRef}
          aria-label="Search assignees"
          value={query}
          placeholder={assignees.length ? 'Add…' : 'Search people…'}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && !query && assigneeIds.length) remove(assigneeIds[assigneeIds.length - 1]);
          }}
          className="h-6 min-w-24 flex-1 bg-transparent px-1.5 text-sm text-ink placeholder:text-ink-faint focus:outline-none"
        />
      </div>

      <ComboboxOptions
        anchor={{ to: 'bottom start', gap: 4 }}
        className="z-50 max-h-64 w-[var(--input-width)] min-w-64 overflow-y-auto rounded-card bg-surface p-1 shadow-pop"
      >
        {suggestions.map((user) => (
          <ComboboxOption
            key={user.id}
            value={user}
            className="flex cursor-pointer items-center gap-2.5 rounded-control px-2.5 py-1.5 data-[focus]:bg-brand-50"
          >
            <Avatar user={user} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-ink">{user.name}</span>
              <span className="block truncate text-xs text-ink-subtle">{user.title}</span>
            </span>
          </ComboboxOption>
        ))}
        {suggestions.length === 0 && (
          <div className="px-3 py-2.5 text-xs text-ink-subtle">
            {query.trim()
              ? `No one with access to this list matches “${query.trim()}”.`
              : 'Everyone with access to this list is already assigned.'}
          </div>
        )}
      </ComboboxOptions>
    </Combobox>
  );
}
