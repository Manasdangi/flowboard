import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import type { ID } from '@/domain/types';

/** Ephemeral UI state that several distant components need (not persisted). */
export type ContainerDialog =
  | { kind: 'create'; parentId: ID }
  | { kind: 'share'; containerId: ID }
  | { kind: 'statuses'; listId: ID }
  | { kind: 'archive'; containerId: ID };

interface UiState {
  searchOpen: boolean;
  dialog: ContainerDialog | null;
  setSearchOpen: (open: boolean) => void;
  openDialog: (dialog: ContainerDialog | null) => void;
}

export const uiStore = createStore<UiState>((set) => ({
  searchOpen: false,
  dialog: null,
  setSearchOpen: (searchOpen) => set({ searchOpen }),
  openDialog: (dialog) => set({ dialog }),
}));

export const useUi = <T>(selector: (s: UiState) => T) => useStore(uiStore, selector);
