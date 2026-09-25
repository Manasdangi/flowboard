import {
  Combobox,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from '@headlessui/react';
import { Search, SearchX } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { searchTasks, type SearchHit } from '@/domain/selectors';
import { navigate } from '@/lib/router';
import { useAppStore } from '@/store/hooks';
import { uiStore, useUi } from '@/store/ui';
import { Kbd } from '../ui/Kbd';
import { StatusPill } from '../ui/Badges';

/** ⌘K / "/" task search across every list the current user can see. */
export function SearchPalette() {
  const open = useUi((s) => s.searchOpen);
  const data = useAppStore((s) => s.data);
  const userId = useAppStore((s) => s.currentUserId);
  const [query, setQuery] = useState('');
  const hits = useMemo(() => searchTasks(data, userId, query, 12), [data, userId, query]);
  const close = () => {
    uiStore.getState().setSearchOpen(false);
    setQuery('');
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) {
        e.preventDefault();
        uiStore.getState().setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const select = (hit: SearchHit | null) => {
    if (!hit) return;
    navigate({ listId: hit.list.id, taskId: hit.task.id });
    close();
  };

  return (
    <Dialog open={open} onClose={close} className="relative z-50">
      <DialogBackdrop className="fixed inset-0 animate-fade-in bg-ink/30 backdrop-blur-[2px]" />
      <div className="fixed inset-0 flex items-start justify-center p-4 pt-[14vh]">
        <DialogPanel className="w-full max-w-xl animate-pop-in overflow-hidden rounded-panel bg-surface shadow-pop">
          <DialogTitle className="sr-only">Search tasks</DialogTitle>
          <Combobox onChange={select}>
            <div className="flex items-center gap-3 border-b border-line px-4">
              <Search className="h-4 w-4 text-ink-subtle" aria-hidden />
              <ComboboxInput
                autoFocus
                aria-label="Search tasks"
                placeholder="Search task titles and descriptions…"
                onChange={(e) => setQuery(e.target.value)}
                className="h-12 flex-1 bg-transparent text-sm text-ink placeholder:text-ink-faint focus:outline-none"
              />
              <Kbd>Esc</Kbd>
            </div>
            {query.trim() && hits.length > 0 && (
              <ComboboxOptions static className="max-h-80 overflow-y-auto p-1.5">
                {hits.map((hit) => (
                  <ComboboxOption
                    key={hit.task.id}
                    value={hit}
                    className="flex cursor-pointer items-center gap-3 rounded-control px-3 py-2 data-[focus]:bg-brand-50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{hit.task.title}</p>
                      <p className="truncate text-xs text-ink-subtle">
                        {hit.list.name}
                        {hit.task.parentTaskId && ' · subtask'}
                        {hit.task.description && ` · ${hit.task.description}`}
                      </p>
                    </div>
                    <StatusPill status={hit.status} />
                  </ComboboxOption>
                ))}
              </ComboboxOptions>
            )}
            {query.trim() && hits.length === 0 && (
              <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
                <SearchX className="h-6 w-6 text-ink-faint" />
                <p className="text-sm font-medium text-ink">No tasks match “{query}”</p>
                <p className="text-xs text-ink-subtle">Search only covers lists you have access to.</p>
              </div>
            )}
            {!query.trim() && (
              <p className="px-4 py-6 text-center text-xs text-ink-subtle">
                Type to search. <Kbd>↑</Kbd> <Kbd>↓</Kbd> to move, <Kbd>↵</Kbd> to open.
              </p>
            )}
          </Combobox>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
