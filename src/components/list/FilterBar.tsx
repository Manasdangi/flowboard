import { Search, X } from 'lucide-react';
import type { TaskFilters } from '@/domain/selectors';
import type { User } from '@/domain/types';
import { IconButton } from '../ui/Button';
import { TextInput } from '../ui/Field';
import { AssigneeFilter } from './AssigneeFilter';

/**
 * Narrow the tasks on screen by name and by one or more assignees. The same bar sits
 * above the board and the list, so a filter carries over when you switch views.
 * `people` is limited to those who can see the list, so the filter never names anyone else.
 */
export function FilterBar({
  filters,
  people,
  onChange,
}: {
  filters: TaskFilters;
  people: User[];
  onChange: (patch: Partial<TaskFilters>) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-72">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-subtle"
          aria-hidden
        />
        <TextInput
          aria-label="Filter tasks by name"
          placeholder="Search by task name…"
          value={filters.query}
          onChange={(e) => onChange({ query: e.target.value })}
          onKeyDown={(e) => e.key === 'Escape' && filters.query && onChange({ query: '' })}
          className="h-9 pl-8 pr-8"
        />
        {filters.query && (
          <IconButton
            label="Clear search"
            onClick={() => onChange({ query: '' })}
            className="absolute right-1 top-1/2 h-6 w-6 -translate-y-1/2"
          >
            <X className="h-3.5 w-3.5" />
          </IconButton>
        )}
      </div>
      <AssigneeFilter people={people} selected={filters.assignees} onChange={(assignees) => onChange({ assignees })} />
    </div>
  );
}
