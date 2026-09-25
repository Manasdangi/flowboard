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
 * Single-assignee field. The current assignee is a removable chip; typing
 * searches the people who can see this list (the store scopes `candidates`),
 * and picking someone replaces the current assignee.
 * ↑/↓ + Enter picks a suggestion, Backspace on an empty query unassigns.
 */
export function AssigneePicker({
  assigneeId,
  candidates,
  users,
  onChange,
}: {
  assigneeId: ID | null;
  /** Users allowed to be assigned (have access to the list). */
  candidates: User[];
  /** All users, to render the chip for the existing assignee. */
  users: Record<ID, User>;
  onChange: (id: ID | null) => void;
}) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const assignee = assigneeId ? users[assigneeId] : undefined;
  const hasAccess = !!assignee && candidates.some((u) => u.id === assignee.id);
  const suggestions = candidates.filter((u) => u.id !== assigneeId && matches(u, query));

  const pick = (user: User | null) => {
    if (!user) return;
    onChange(user.id);
    setQuery('');
  };

  return (
    <Combobox value={null} onChange={pick} immediate>
      <div
        onClick={() => inputRef.current?.focus()}
        className="flex h-8 w-full cursor-text items-center gap-1 rounded-control bg-surface px-1 ring-1 ring-inset ring-line-strong transition-shadow focus-within:ring-2 focus-within:ring-brand-500 hover:ring-ink-faint"
      >
        {assignee && (
          <span
            data-testid="assignee-chip"
            title={hasAccess ? assignee.email : `${assignee.name} can no longer see this list`}
            className={cn(
              'inline-flex h-6 shrink-0 items-center gap-1 rounded-full py-0.5 pl-0.5 pr-1 text-xs font-medium',
              hasAccess ? 'bg-brand-50 text-brand-800' : 'bg-surface-sunken text-ink-subtle line-through',
            )}
          >
            <Avatar user={assignee} size="xs" />
            {assignee.name}
            <button
              type="button"
              aria-label={`Unassign ${assignee.name}`}
              onClick={(e) => {
                e.stopPropagation();
                onChange(null);
              }}
              className="flex h-4 w-4 items-center justify-center rounded-full opacity-60 hover:bg-brand-100 hover:opacity-100"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        )}
        <ComboboxInput
          ref={inputRef}
          aria-label="Search assignee"
          value={query}
          placeholder={assignee ? 'Reassign…' : 'Search people…'}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && !query && assignee) onChange(null);
          }}
          className="h-6 min-w-0 flex-1 bg-transparent px-1.5 text-sm text-ink placeholder:text-ink-faint focus:outline-none"
        />
      </div>

      <ComboboxOptions
        anchor={{ to: 'bottom start', gap: 4 }}
        className="z-50 max-h-64 w-[var(--input-width)] min-w-64 overflow-y-auto rounded-card bg-surface p-1 shadow-pop"
      >
        {suggestions.map((u) => (
          <ComboboxOption
            key={u.id}
            value={u}
            className="flex cursor-pointer items-center gap-2.5 rounded-control px-2.5 py-1.5 data-[focus]:bg-brand-50"
          >
            <Avatar user={u} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-ink">{u.name}</span>
              <span className="block truncate text-xs text-ink-subtle">{u.title}</span>
            </span>
          </ComboboxOption>
        ))}
        {suggestions.length === 0 && (
          <div className="px-3 py-2.5 text-xs text-ink-subtle">
            {query.trim()
              ? `No one with access to this list matches “${query.trim()}”.`
              : 'No one else has access to this list.'}
          </div>
        )}
      </ComboboxOptions>
    </Combobox>
  );
}
