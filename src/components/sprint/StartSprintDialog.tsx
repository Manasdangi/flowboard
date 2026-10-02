import { useState, type FormEvent } from 'react';
import { SPRINT_NAME_MAX } from '@/domain/sprints';
import type { ID } from '@/domain/types';
import { fromDateInput } from '@/lib/dates';
import { useActions, useDataWith } from '@/store/hooks';
import { notify } from '@/store/toasts';
import { Button } from '../ui/Button';
import { FieldLabel, TextInput } from '../ui/Field';
import { Modal } from '../ui/Modal';

/** Name a sprint, optionally pick its last day, and start it on this list. */
export function StartSprintDialog({ listId, onClose }: { listId: ID; onClose: () => void }) {
  const data = useDataWith('sprints');
  const { startSprint } = useActions();
  const list = data.containers[listId];
  const [name, setName] = useState(
    () => `Sprint ${Object.values(data.sprints).filter((s) => s.listId === listId).length + 1}`,
  );
  const [endsOn, setEndsOn] = useState('');
  const [error, setError] = useState<string | null>(null);
  if (!list) return null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const result = startSprint({ listId, name, endsOn: fromDateInput(endsOn) });
    if (result.error) return setError(result.error.message);
    notify.success(`Started “${result.data.name}”`, 'Open tasks in this list are part of it.');
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Start a sprint"
      description={`In ${list.name}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="start-sprint" disabled={!name.trim()}>
            Start sprint
          </Button>
        </>
      }
    >
      <form id="start-sprint" onSubmit={submit} className="space-y-4">
        <div>
          <FieldLabel htmlFor="sprint-name">Name</FieldLabel>
          <TextInput
            id="sprint-name"
            autoFocus
            value={name}
            maxLength={SPRINT_NAME_MAX}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
          />
        </div>
        <div>
          <FieldLabel htmlFor="sprint-ends" hint="Optional">
            Ends on
          </FieldLabel>
          <TextInput
            id="sprint-ends"
            type="date"
            value={endsOn}
            className="w-44 cursor-pointer"
            onChange={(e) => {
              setEndsOn(e.target.value);
              setError(null);
            }}
          />
        </div>
        {error && (
          <p role="alert" className="text-xs text-rose-600">
            {error}
          </p>
        )}
        <p className="text-xs text-ink-subtle">
          Every task in this list that isn’t done yet joins the sprint, and so does anything you add while it runs. When
          you end it, you’ll get a report of what was finished and what spilled over.
        </p>
      </form>
    </Modal>
  );
}
