import { useUi, uiStore } from '@/store/ui';
import { ArchiveDialog } from './ArchiveDialog';
import { CreateContainerDialog } from './CreateContainerDialog';
import { EndSprintDialog } from '../sprint/EndSprintDialog';
import { SprintReportDialog } from '../sprint/SprintReportDialog';
import { StartSprintDialog } from '../sprint/StartSprintDialog';
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
    case 'sprint-start':
      return <StartSprintDialog listId={dialog.listId} onClose={close} />;
    case 'sprint-end':
      return <EndSprintDialog listId={dialog.listId} onClose={close} />;
    case 'sprint-report':
      return <SprintReportDialog sprintId={dialog.sprintId} onClose={close} />;
  }
}
