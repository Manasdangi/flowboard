import { useUi, uiStore } from '@/store/ui';
import { ArchiveDialog } from './ArchiveDialog';
import { CreateContainerDialog } from './CreateContainerDialog';
import { ShareDialog } from './ShareDialog';
import { StatusDialog } from './StatusDialog';

/** Renders whichever container dialog is open (one at a time). */
export function ContainerDialogs() {
  const dialog = useUi((s) => s.dialog);
  const close = () => uiStore.getState().openDialog(null);
  if (!dialog) return null;
  switch (dialog.kind) {
    case 'create':
      return <CreateContainerDialog parentId={dialog.parentId} onClose={close} />;
    case 'share':
      return <ShareDialog containerId={dialog.containerId} onClose={close} />;
    case 'statuses':
      return <StatusDialog listId={dialog.listId} onClose={close} />;
    case 'archive':
      return <ArchiveDialog containerId={dialog.containerId} onClose={close} />;
  }
}
