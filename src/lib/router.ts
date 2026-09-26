/**
 * Minimal path router: /list/<listId>/<board|list>?task=<taskId>
 * Clean URLs via the History API, the same shape Linear / Jira / ClickUp use.
 * Deep links make "open a resource you can't access" reproducible — paste
 * Alice's URL while signed in as Bob and you get the 403 screen.
 *
 * Hosting: a refresh or pasted link requests the real path from the server, so
 * the host must serve index.html for unknown paths. Vite's dev/preview servers
 * do this already; vercel.json does it on Vercel.
 */
import { useSyncExternalStore } from 'react';

export type ViewMode = 'board' | 'list';

export interface Route {
  listId: string | null;
  view: ViewMode;
  taskId: string | null;
}

function parseUrl(url: string): Route {
  const [path, query = ''] = url.split('?');
  const parts = path.split('/').filter(Boolean);
  const params = new URLSearchParams(query);
  return {
    listId: parts[0] === 'list' && parts[1] ? decodeURIComponent(parts[1]) : null,
    view: parts[2] === 'list' ? 'list' : 'board',
    taskId: params.get('task'),
  };
}

export function buildPath(route: Route): string {
  if (!route.listId) return route.taskId ? `/?task=${encodeURIComponent(route.taskId)}` : '/';
  const base = `/list/${encodeURIComponent(route.listId)}/${route.view}`;
  return route.taskId ? `${base}?task=${encodeURIComponent(route.taskId)}` : base;
}

const currentUrl = () => window.location.pathname + window.location.search;

const subscribe = (cb: () => void) => {
  window.addEventListener('popstate', cb);
  return () => window.removeEventListener('popstate', cb);
};

export function navigate(patch: Partial<Route>, opts: { replace?: boolean } = {}) {
  const next = buildPath({ ...parseUrl(currentUrl()), ...patch });
  if (next === currentUrl()) return;
  if (opts.replace) history.replaceState(null, '', next);
  else history.pushState(null, '', next);
  // pushState doesn't fire popstate, so tell subscribers ourselves.
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function useRoute(): [Route, typeof navigate] {
  const url = useSyncExternalStore(subscribe, currentUrl, currentUrl);
  return [parseUrl(url), navigate];
}
