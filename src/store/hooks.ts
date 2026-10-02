import { useStore } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import type { AppActions, AppState } from './appStore';
import { useAppStoreApi } from './context';
import { topLevelTaskCounts } from '@/domain/tasks';
import type { DataState, DataWith, ID, User } from '@/domain/types';

export function useAppStore<T>(selector: (s: AppState) => T): T {
  return useStore(useAppStoreApi(), selector);
}

export const useActions = (): AppActions => useAppStore((s) => s.actions);
export const useCurrentUser = (): User => useAppStore((s) => s.data.users[s.currentUserId]);
export const useIsAdmin = () => useAppStore((s) => s.data.users[s.currentUserId]?.role === 'admin');

/** Top-level task count per list (sidebar badges). Re-renders only when a count changes, not on every task edit. */
export const useTaskCounts = (): Record<ID, number> => useAppStore(useShallow((s) => topLevelTaskCounts(s.data.tasks)));

/** The slices every permission and tree check reads. They are always included. */
const ACCESS_KEYS = ['workspaceId', 'users', 'containers', 'grants'] as const;

/**
 * Subscribe to the access data plus the slices you name, not the whole data set:
 * `useDataWith('tasks', 'statuses')`. The component re-renders only when one of those
 * slices is replaced, so a new comment doesn't re-render a component that never reads
 * comments. The returned object stays the same between renders while every slice does,
 * which keeps it safe as a `useMemo` dependency. Pass it straight to the domain read functions.
 */
export function useDataWith<K extends keyof DataState>(...extra: K[]): DataWith<K> {
  return useAppStore(
    useShallow((s) => {
      const picked: Partial<DataState> = {};
      for (const key of [...ACCESS_KEYS, ...extra]) Object.assign(picked, { [key]: s.data[key] });
      return picked as DataWith<K>;
    }),
  );
}
