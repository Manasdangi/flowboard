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
  /** Task just created by "New task"; discarded on drawer close if left untouched. */
  draftTaskId: ID | null;
  setSearchOpen: (open: boolean) => void;
  openDialog: (dialog: ContainerDialog | null) => void;
  setDraftTaskId: (id: ID | null) => void;
}

export const uiStore = createStore<UiState>((set) => ({
  searchOpen: false,
  dialog: null,
  draftTaskId: null,
  setSearchOpen: (searchOpen) => set({ searchOpen }),
  openDialog: (dialog) => set({ dialog }),
  setDraftTaskId: (draftTaskId) => set({ draftTaskId }),
}));

export const useUi = <T>(selector: (s: UiState) => T) => useStore(uiStore, selector);
