import { createContext, useContext, type ReactNode } from 'react';

import type { AppStore } from './appStore';

const StoreContext = createContext<AppStore | null>(null);

export function StoreProvider({ store, children }: { store: AppStore; children: ReactNode }) {
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useAppStoreApi(): AppStore {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useAppStore must be used inside <StoreProvider>');
  return store;
}
