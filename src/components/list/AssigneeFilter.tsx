import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from '@headlessui/react';
import { Check, ChevronDown, UserRoundX, Users, X } from 'lucide-react';
import { UNASSIGNED } from '@/domain/selectors';
import type { User } from '@/domain/types';
import { cn } from '@/lib/cn';
import { FOCUS_RING } from '@/ui/tokens';
import { Avatar } from '../ui/Avatar';

/**
 * Multi-select "filter by assignee" for the list view. An empty selection
 * means no filter. `people` should already be limited to users who can see
 * the list, so the filter never reveals anyone else.
 */
export function AssigneeFilter({
  people,
  selected,
  onChange,
}: {
  people: User[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const nameOf = (id: string) =>
    id === UNASSIGNED ? 'Unassigned' : (people.find((u) => u.id === id)?.name.split(' ')[0] ?? id);
  const summary =
    selected.length === 0
      ? 'All'
      : selected.length <= 2
        ? selected.map(nameOf).join(', ')
        : `${selected.length} selected`;

  return (
    <div className="flex items-center gap-1">
      <Listbox value={selected} onChange={onChange} multiple>
        <ListboxButton
          aria-label="Filter by assignee"
          className={cn(
            'flex h-8 items-center gap-2 rounded-control px-2.5 text-sm ring-1 ring-inset transition-colors',
            selected.length
              ? 'bg-brand-50 text-brand-800 ring-brand-200'
              : 'bg-surface text-ink-muted ring-line-strong hover:ring-ink-faint',
            FOCUS_RING,
          )}
        >
          <Users className="h-3.5 w-3.5" aria-hidden />
          <span>
            Assignees: <span className="font-medium">{summary}</span>
          </span>
          <ChevronDown className="h-3.5 w-3.5 opacity-60" aria-hidden />
        </ListboxButton>
        <ListboxOptions
          anchor={{ to: 'bottom start', gap: 4 }}
          className="z-50 min-w-56 rounded-card bg-surface p-1 shadow-pop outline-none"
        >
          <p className="px-2.5 pb-1 pt-1.5 text-2xs font-semibold uppercase tracking-wide text-ink-subtle">
            Pick one or more
          </p>
          {people.map((user) => (
            <ListboxOption
              key={user.id}
              value={user.id}
              className="group flex cursor-pointer items-center gap-2.5 rounded-control px-2.5 py-1.5 text-sm text-ink data-[focus]:bg-surface-sunken"
            >
              <Box />
              <Avatar user={user} size="sm" />
              <span className="flex-1">{user.name}</span>
            </ListboxOption>
          ))}
          <ListboxOption
            value={UNASSIGNED}
            className="group flex cursor-pointer items-center gap-2.5 rounded-control px-2.5 py-1.5 text-sm text-ink-muted data-[focus]:bg-surface-sunken"
          >
            <Box />
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-sunken">
              <UserRoundX className="h-3.5 w-3.5" aria-hidden />
            </span>
            <span className="flex-1">Unassigned</span>
          </ListboxOption>
        </ListboxOptions>
      </Listbox>
      {selected.length > 0 && (
        <button
          type="button"
          aria-label="Clear assignee filter"
          title="Clear filter"
          onClick={() => onChange([])}
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-control text-ink-subtle hover:bg-surface-sunken hover:text-ink',
            FOCUS_RING,
          )}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

/** The tick box on each option. It fills in when the option is selected (the parent option is `group`). */
function Box() {
  return (
    <span
      aria-hidden
      className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-line-strong bg-surface group-data-[selected]:border-brand-600 group-data-[selected]:bg-brand-600"
    >
      <Check className="h-3 w-3 text-white opacity-0 group-data-[selected]:opacity-100" strokeWidth={3} />
    </span>
  );
}
