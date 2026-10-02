import {
  Combobox,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
  Popover,
  PopoverButton,
  PopoverPanel,
} from '@headlessui/react';
import { Check, Search, UserPlus } from 'lucide-react';
import { useState } from 'react';
import type { ID, User } from '@/domain/types';
import { cn } from '@/lib/cn';
import { FOCUS_RING } from '@/ui/tokens';
import { Avatar, AvatarStack } from '../ui/Avatar';

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
 * Assignee button for the task title. It shows the current assignees (or a
 * "add person" icon) and opens a searchable list of the people who can see this
 * list (the store scopes `candidates`). Click people to assign or unassign them;
 * the list stays open so several can be picked at once.
 */
export function AssigneePicker({
  assigneeIds,
  candidates,
  users,
  onChange,
  compact = false,
}: {
  assigneeIds: ID[];
  /** Users allowed to be assigned (they can see the list). */
  candidates: User[];
  /** All users, to render the current assignees. */
  users: Record<ID, User>;
  onChange: (ids: ID[]) => void;
  /** A smaller trigger, for cards and table rows. */
  compact?: boolean;
}) {
  const [query, setQuery] = useState('');
  const assignees = assigneeIds.map((id) => users[id]).filter(Boolean);
  const canSeeList = new Set(candidates.map((u) => u.id));
  // Anyone already assigned who lost access to the list stays listed, so they can be unassigned.
  const people = [...candidates, ...assignees.filter((u) => !canSeeList.has(u.id))].filter((u) => matches(u, query));
  const label = assignees.length ? `Assignees: ${assignees.map((u) => u.name).join(', ')}` : 'Assign people';

  return (
    <Popover className="relative shrink-0">
      <PopoverButton
        aria-label={label}
        title={label}
        className={cn(
          'flex items-center justify-center rounded-full transition-colors',
          compact ? 'h-6 min-w-6' : 'h-9 min-w-9',
          assignees.length
            ? 'px-0.5 hover:bg-surface-sunken data-[open]:bg-surface-sunken'
            : 'border border-dashed border-line-strong text-ink-subtle hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700 data-[open]:border-brand-400 data-[open]:bg-brand-50',
          FOCUS_RING,
        )}
      >
        {assignees.length ? (
          <AvatarStack users={assignees} size={compact ? 'xs' : 'md'} />
        ) : (
          <UserPlus className={compact ? 'h-3 w-3' : 'h-4 w-4'} aria-hidden />
        )}
      </PopoverButton>

      <PopoverPanel
        focus
        anchor={{ to: 'bottom start', gap: 6 }}
        className="z-50 w-72 rounded-card bg-surface p-1.5 shadow-pop"
      >
        <Combobox
          multiple
          value={assigneeIds}
          onChange={(ids: ID[]) => {
            onChange(ids);
            setQuery(''); // back to the full list, ready for the next person
          }}
        >
          <div className="flex items-center gap-2 border-b border-line px-2 pb-1.5 pt-0.5">
            <Search className="h-3.5 w-3.5 shrink-0 text-ink-subtle" aria-hidden />
            <ComboboxInput
              autoFocus
              aria-label="Search assignees"
              value={query}
              placeholder="Search people…"
              onChange={(e) => setQuery(e.target.value)}
              className="h-7 min-w-0 flex-1 bg-transparent text-sm text-ink placeholder:text-ink-faint focus:outline-none"
            />
          </div>
          <ComboboxOptions static className="mt-1 max-h-64 overflow-y-auto">
            {people.map((user) => (
              <ComboboxOption
                key={user.id}
                value={user.id}
                className="group flex cursor-pointer items-center gap-2.5 rounded-control px-2 py-1.5 data-[focus]:bg-brand-50"
              >
                <Avatar user={user} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">{user.name}</span>
                  <span className="block truncate text-xs text-ink-subtle">
                    {canSeeList.has(user.id) ? user.title : 'Can no longer see this list'}
                  </span>
                </span>
                <Check
                  className="h-3.5 w-3.5 shrink-0 text-brand-600 opacity-0 group-data-[selected]:opacity-100"
                  aria-hidden
                />
              </ComboboxOption>
            ))}
            {people.length === 0 && (
              <div className="px-3 py-2.5 text-xs text-ink-subtle">
                {query.trim()
                  ? `No one with access to this list matches “${query.trim()}”.`
                  : 'No one has access to this list.'}
              </div>
            )}
          </ComboboxOptions>
        </Combobox>
      </PopoverPanel>
    </Popover>
  );
}
