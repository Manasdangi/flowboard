import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './index.css';
import { createAppStore } from './store/appStore';
import { StoreProvider } from './store/context';
import { loadPersisted, persistStore } from './store/persistence';
import { notify } from './store/toasts';

const persisted = loadPersisted();

const TITLES: Record<string, string> = {
  FORBIDDEN: 'Permission denied',
  NOT_FOUND: 'Not found',
  VALIDATION: 'Check your input',
  CONFLICT: 'Can’t do that',
  NETWORK: 'Save failed',
};

const store = createAppStore({
  initialData: persisted?.data,
  currentUserId: persisted?.currentUserId,
  settings: persisted?.settings,
  // Every failed store mutation surfaces as a toast — one place, no per-call handling.
  onError: (error) => notify.error(TITLES[error.code] ?? 'Something went wrong', error.message),
});
persistStore(store);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider store={store}>
      <App />
    </StoreProvider>
  </StrictMode>,
);
