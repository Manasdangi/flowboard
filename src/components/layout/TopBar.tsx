import { ChevronRight, WifiOff } from 'lucide-react';
import { useMemo } from 'react';
import { canViewContainer } from '@/domain/permissions';
import { ancestorsOf } from '@/domain/tree';
import { useRoute } from '@/lib/router';
import { useAppStore, useData } from '@/store/hooks';
import { UserSwitcher } from './UserSwitcher';

export function TopBar() {
  const data = useData();
  const userId = useAppStore((s) => s.currentUserId);
  const failing = useAppStore((s) => s.settings.simulateFailures);
  const [route] = useRoute();

  // Breadcrumbs only for lists the user may open — never leak names of forbidden ones.
  const path = useMemo(
    () => (route.listId && canViewContainer(data, userId, route.listId) ? ancestorsOf(data, route.listId) : []),
    [data, userId, route.listId],
  );

  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-line bg-surface px-6">
      <nav aria-label="Breadcrumb" className="flex min-w-0 flex-1 items-center gap-1 text-sm">
        {path.map((c, i) => (
          <span key={c.id} className="flex min-w-0 items-center gap-1">
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink-faint" aria-hidden />}
            <span className={i === path.length - 1 ? 'truncate font-semibold text-ink' : 'truncate text-ink-subtle'}>
              {c.name}
            </span>
          </span>
        ))}
      </nav>
      {failing && (
        <span className="flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700 ring-1 ring-inset ring-rose-200">
          <WifiOff className="h-3.5 w-3.5" /> Saves will fail
        </span>
      )}
      <UserSwitcher />
    </header>
  );
}
