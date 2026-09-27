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

/** Everything the URL encodes: the open list, its view, and the task open in the drawer. */
export interface Route {
  listId: string | null;
  view: ViewMode;
  taskId: string | null;
}

/** URL → Route. Unknown paths give no list; any view other than "list" means board. */
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

/** Route → URL, e.g. { listId: 'ls_sprint', view: 'board', taskId: 't_sp_1' } → /list/ls_sprint/board?task=t_sp_1 */
export function buildPath(route: Route): string {
  if (!route.listId) return route.taskId ? `/?task=${encodeURIComponent(route.taskId)}` : '/';
  const base = `/list/${encodeURIComponent(route.listId)}/${route.view}`;
  return route.taskId ? `${base}?task=${encodeURIComponent(route.taskId)}` : base;
}

/** The browser's current path + query string (the router's single source of truth). */
const currentUrl = () => window.location.pathname + window.location.search;

/** Run `cb` whenever the URL changes (Back/Forward, or `navigate`). Returns an unsubscribe. */
const subscribe = (cb: () => void) => {
  window.addEventListener('popstate', cb);
  return () => window.removeEventListener('popstate', cb);
};

/**
 * Change part of the URL and keep the rest, e.g. navigate({ taskId: null }) closes the drawer.
 * Adds a history entry (Back undoes it) unless `replace` is set. No-op if nothing changes.
 */
export function navigate(patch: Partial<Route>, opts: { replace?: boolean } = {}) {
  const next = buildPath({ ...parseUrl(currentUrl()), ...patch });
  if (next === currentUrl()) return;
  if (opts.replace) history.replaceState(null, '', next);
  else history.pushState(null, '', next);
  // pushState doesn't fire popstate, so tell subscribers ourselves.
  window.dispatchEvent(new PopStateEvent('popstate'));
}

/** React hook: the current Route plus `navigate`. Re-renders the component whenever the URL changes. */
export function useRoute(): [Route, typeof navigate] {
  const url = useSyncExternalStore(subscribe, currentUrl, currentUrl);
  return [parseUrl(url), navigate];
}
