import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';

export type ToastTone = 'error' | 'success' | 'info';

export interface Toast {
  id: number;
  tone: ToastTone;
  title: string;
  message?: string;
}

interface ToastState {
  toasts: Toast[];
  push: (toast: Omit<Toast, 'id'>, ttlMs?: number) => number;
  dismiss: (id: number) => void;
}

let seq = 0;

const toastStore = createStore<ToastState>((set, get) => ({
  toasts: [],
  push: (toast, ttlMs = 4500) => {
    const id = ++seq;
    // Keep at most 4 on screen; newest at the bottom.
    set({ toasts: [...get().toasts.slice(-3), { ...toast, id }] });
    if (ttlMs > 0) setTimeout(() => get().dismiss(id), ttlMs);
    return id;
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));

export const useToasts = <T>(selector: (s: ToastState) => T) => useStore(toastStore, selector);

export const notify = {
  error: (title: string, message?: string) => toastStore.getState().push({ tone: 'error', title, message }, 6000),
  success: (title: string, message?: string) => toastStore.getState().push({ tone: 'success', title, message }),
  info: (title: string, message?: string) => toastStore.getState().push({ tone: 'info', title, message }),
};
