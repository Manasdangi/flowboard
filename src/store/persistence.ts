/**
 * Optional localStorage persistence. The data graph, the selected user and
 * the demo settings survive a reload; "Reset demo data" restores the seed.
 * Bump SCHEMA_VERSION whenever DataState changes shape — old blobs are dropped.
 */
import type { DataState, ID } from '@/domain/types';
import type { AppStore } from './appStore';
import type { TransportSettings } from './transport';

const KEY = 'flowboard:v2';
// v2: tasks have at most one assignee — v1 blobs (which may have several) are discarded.
const SCHEMA_VERSION = 2;

interface Persisted {
  version: number;
  data: DataState;
  currentUserId: ID;
  settings: Pick<TransportSettings, 'simulateFailures'>;
}

export function loadPersisted(): Omit<Persisted, 'version'> | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Persisted;
    if (parsed.version !== SCHEMA_VERSION || !parsed.data?.containers || !parsed.data.users[parsed.currentUserId]) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function persistStore(store: AppStore): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return store.subscribe((state, prev) => {
    if (state.data === prev.data && state.currentUserId === prev.currentUserId && state.settings === prev.settings) {
      return;
    }
    clearTimeout(timer);
    timer = setTimeout(() => {
      const blob: Persisted = {
        version: SCHEMA_VERSION,
        data: state.data,
        currentUserId: state.currentUserId,
        settings: { simulateFailures: state.settings.simulateFailures },
      };
      try {
        localStorage.setItem(KEY, JSON.stringify(blob));
      } catch {
        // Quota / private mode — persistence is best-effort.
      }
    }, 250);
  });
}
