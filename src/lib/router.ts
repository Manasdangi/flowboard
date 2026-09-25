/**
 * Minimal hash router: #/list/<listId>/<board|list>?task=<taskId>
 * Deep links make "open a resource you can't access" reproducible —
 * paste Alice's URL while signed in as Bob and you get the 403 screen.
 */
import { useSyncExternalStore } from 'react';

export type ViewMode = 'board' | 'list';

export interface Route {
  listId: string | null;
  view: ViewMode;
  taskId: string | null;
}

function parseHash(hash: string): Route {
  const [path, query = ''] = hash.replace(/^#/, '').split('?');
  const parts = path.split('/').filter(Boolean);
  const params = new URLSearchParams(query);
  return {
    listId: parts[0] === 'list' && parts[1] ? decodeURIComponent(parts[1]) : null,
    view: parts[2] === 'list' ? 'list' : 'board',
    taskId: params.get('task'),
  };
}

export function buildHash(route: Route): string {
  if (!route.listId) return route.taskId ? `#/?task=${encodeURIComponent(route.taskId)}` : '#/';
  const base = `#/list/${encodeURIComponent(route.listId)}/${route.view}`;
  return route.taskId ? `${base}?task=${encodeURIComponent(route.taskId)}` : base;
}

const subscribe = (cb: () => void) => {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
};
const getHash = () => window.location.hash;

export function navigate(patch: Partial<Route>, opts: { replace?: boolean } = {}) {
  const next = buildHash({ ...parseHash(window.location.hash), ...patch });
  if (next === window.location.hash) return;
  if (opts.replace) {
    history.replaceState(null, '', next);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    window.location.hash = next;
  }
}

export function useRoute(): [Route, typeof navigate] {
  const hash = useSyncExternalStore(subscribe, getHash, getHash);
  return [parseHash(hash), navigate];
}
