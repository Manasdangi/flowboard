import { useStore } from 'zustand';
import type { AppActions, AppState } from './appStore';
import { useAppStoreApi } from './context';
import type { DataState, User } from '@/domain/types';

export function useAppStore<T>(selector: (s: AppState) => T): T {
  return useStore(useAppStoreApi(), selector);
}

export const useActions = (): AppActions => useAppStore((s) => s.actions);
export const useData = (): DataState => useAppStore((s) => s.data);
export const useCurrentUser = (): User => useAppStore((s) => s.data.users[s.currentUserId]);
export const useIsAdmin = () => useAppStore((s) => s.data.users[s.currentUserId]?.role === 'admin');
