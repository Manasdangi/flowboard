import { useEffect } from 'react';
import { ContainerDialogs } from './components/dialogs/ContainerDialogs';
import { TopBar } from './components/layout/TopBar';
import { ListScreen } from './components/ListScreen';
import { SearchPalette } from './components/search/SearchPalette';
import { Sidebar } from './components/sidebar/Sidebar';
import { TaskDrawer } from './components/task/TaskDrawer';
import { Toaster } from './components/ui/Toaster';
import { useActions, useAppStore } from './store/hooks';

export function App() {
  const { bootstrap } = useActions();
  const boot = useAppStore((s) => s.boot);

  useEffect(() => {
    if (boot === 'loading') void bootstrap();
  }, [boot, bootstrap]);

  return (
    <div className="flex h-full min-w-[960px] overflow-hidden">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="min-h-0 flex-1 overflow-hidden">
          <ListScreen />
        </main>
      </div>
      <TaskDrawer />
      <SearchPalette />
      <ContainerDialogs />
      <Toaster />
    </div>
  );
}
