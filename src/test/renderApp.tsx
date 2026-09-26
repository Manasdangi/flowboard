import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '@/App';
import { createSeed } from '@/data/seed';
import { buildPath, type Route } from '@/lib/router';
import { createAppStore } from '@/store/appStore';
import { StoreProvider } from '@/store/context';
import { notify } from '@/store/toasts';

/** Render the real app against a fresh, instant (0ms latency) store. */
export function renderApp(opts: { userId?: string; route?: Partial<Route> } = {}) {
  window.history.replaceState(null, '', buildPath({ listId: null, view: 'board', taskId: null, ...opts.route }));
  const store = createAppStore({
    initialData: createSeed(),
    currentUserId: opts.userId,
    settings: { latencyMs: 0 },
    ready: true,
    onError: (e) => notify.error(e.code, e.message),
  });
  const user = userEvent.setup();
  const utils = render(
    <StoreProvider store={store}>
      <App />
    </StoreProvider>,
  );
  return { store, user, ...utils };
}
