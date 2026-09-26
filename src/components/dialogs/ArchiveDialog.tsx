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
  // Top-level tasks only, so the number matches the sidebar's task counts.
  const taskCount = Object.values(data.tasks).filter((t) => listIds.has(t.primaryListId) && !t.parentTaskId).length;
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
  const alongWith = [
    inside.length > 0 && plural(inside.length, 'nested item'),
    taskCount > 0 && plural(taskCount, 'task'),
  ].filter(Boolean);

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
        It will disappear for everyone{alongWith.length > 0 && `, along with ${alongWith.join(' and ')}`}. Nothing is
        deleted — admins can restore it.
      </p>
    </Modal>
  );
}
