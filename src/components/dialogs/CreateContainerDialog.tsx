import { useState, type FormEvent } from 'react';
import { CHILD_TYPE } from '@/domain/tree';
import type { ID, Visibility } from '@/domain/types';
import { useActions, useData } from '@/store/hooks';
import { navigate } from '@/lib/router';
import { Button } from '../ui/Button';
import { FieldLabel, TextInput } from '../ui/Field';
import { Modal } from '../ui/Modal';
import { VisibilityPicker } from './VisibilityPicker';

const PLACEHOLDER = { space: 'e.g. Design', folder: 'e.g. Q3 Planning', list: 'e.g. Backlog', workspace: '' };

export function CreateContainerDialog({ parentId, onClose }: { parentId: ID; onClose: () => void }) {
  const data = useData();
  const { createContainer } = useActions();
  const parent = data.containers[parentId];
  const type = parent ? CHILD_TYPE[parent.type] : null;
  const [name, setName] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('public');
  const [error, setError] = useState<string | null>(null);

  if (!parent || !type) return null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const result = createContainer({ parentId, name, visibility });
    if (result.error) return setError(result.error.message);
    if (result.data.type === 'list') navigate({ listId: result.data.id, taskId: null });
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`New ${type}`}
      description={parent.type === 'workspace' ? `In ${parent.name}` : `Inside ${parent.name}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="create-container" disabled={!name.trim()}>
            Create {type}
          </Button>
        </>
      }
    >
      <form id="create-container" onSubmit={submit} className="space-y-4">
        <div>
          <FieldLabel htmlFor="container-name">Name</FieldLabel>
          <TextInput
            id="container-name"
            autoFocus
            value={name}
            maxLength={80}
            placeholder={PLACEHOLDER[type]}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
          />
          {error && (
            <p role="alert" className="mt-1.5 text-xs text-rose-600">
              {error}
            </p>
          )}
        </div>
        <div>
          <FieldLabel>Visibility</FieldLabel>
          <VisibilityPicker value={visibility} onChange={setVisibility} />
        </div>
        {type === 'list' && (
          <p className="text-xs text-ink-subtle">
            New lists start with To do → In progress → Done. You can edit statuses later.
          </p>
        )}
      </form>
    </Modal>
  );
}
