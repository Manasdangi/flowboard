import { Archive } from 'lucide-react';
import type { ID } from '@/domain/types';
import { descendantIds } from '@/domain/tree';
import { notify } from '@/store/toasts';
import { useActions, useData } from '@/store/hooks';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';

export function ArchiveDialog({ containerId, onClose }: { containerId: ID; onClose: () => void }) {
  const data = useData();
  const { archiveContainer } = useActions();
  const container = data.containers[containerId];
  if (!container) return null;
  const inside = descendantIds(data, containerId).map((id) => data.containers[id]);
  const listIds = new Set([containerId, ...inside.map((c) => c.id)]);
  const taskCount = Object.values(data.tasks).filter((t) => listIds.has(t.primaryListId)).length;

  const confirm = () => {
    const result = archiveContainer(containerId);
    if (!result.error)
      notify.success(`Archived "${container.name}"`, 'Restore it any time from Archived in the sidebar.');
    onClose();
  };

  return (
    <Modal
      open
      size="sm"
      onClose={onClose}
      title={`Archive ${container.type} "${container.name}"?`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" onClick={confirm} autoFocus>
            <Archive className="h-3.5 w-3.5" /> Archive
          </Button>
        </>
      }
    >
      <p className="text-sm text-ink-muted">
        It will disappear for everyone
        {inside.length > 0 && (
          <>
            , along with {inside.length} nested item{inside.length === 1 ? '' : 's'}
          </>
        )}
        {taskCount > 0 && (
          <>
            {' '}
            and {taskCount} task{taskCount === 1 ? '' : 's'}
          </>
        )}
        . Nothing is deleted — admins can restore it.
      </p>
    </Modal>
  );
}
