import { useState } from 'react';
import { selectSprints } from '@/domain/selectors';
import type { ID } from '@/domain/types';
import { useActions, useAppStore, useDataWith } from '@/store/hooks';
import { uiStore } from '@/store/ui';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';

/** Confirm ending the running sprint, showing how it stands; then the report opens. */
export function EndSprintDialog({ listId, onClose }: { listId: ID; onClose: () => void }) {
  const data = useDataWith('tasks', 'statuses', 'sprints');
  const userId = useAppStore((s) => s.currentUserId);
  const { endSprint } = useActions();
  const [error, setError] = useState<string | null>(null);
  const active = selectSprints(data, userId, listId).data?.active;
  if (!active) return null;
  const { sprint, total, done, open } = active;

  const confirm = () => {
    const result = endSprint(sprint.id);
    if (result.error) return setError(result.error.message);
    // The report replaces this dialog, so it can be read or printed straight away.
    uiStore.getState().openDialog({ kind: 'sprint-report', sprintId: sprint.id });
  };

  return (
    <Modal
      open
      size="sm"
      onClose={onClose}
      title={`End “${sprint.name}”?`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={confirm} autoFocus>
            End sprint
          </Button>
        </>
      }
    >
      <p className="text-sm text-ink-muted">
        {total === 0 ? (
          'There are no tasks in this sprint.'
        ) : (
          <>
            <span className="font-semibold text-ink">{done}</span> of {total} task{total === 1 ? '' : 's'} done.{' '}
            <span className="font-semibold text-ink">{open}</span> will spill over.
          </>
        )}
      </p>
      <p className="mt-2 text-xs text-ink-subtle">
        Tasks that aren’t done stay in the list, ready for the next sprint. The report is saved and can be printed.
      </p>
      {error && (
        <p role="alert" className="mt-3 text-xs text-rose-600">
          {error}
        </p>
      )}
    </Modal>
  );
}
