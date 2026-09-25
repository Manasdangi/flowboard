import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { CATEGORY_LABEL, statusesForList } from '@/domain/statuses';
import type { ID, Status, StatusCategory, StatusColor } from '@/domain/types';
import { cn } from '@/lib/cn';
import { useActions, useData } from '@/store/hooks';
import { STATUS_COLORS, STATUS_STYLES } from '@/ui/tokens';
import { Button, IconButton } from '../ui/Button';
import { Select, TextInput } from '../ui/Field';
import { Modal } from '../ui/Modal';
import { StatusIcon } from '../ui/Badges';

const CATEGORIES = Object.keys(CATEGORY_LABEL) as StatusCategory[];

export function StatusDialog({ listId, onClose }: { listId: ID; onClose: () => void }) {
  const data = useData();
  const { addStatus } = useActions();
  const list = data.containers[listId];
  const statuses = statusesForList(data, listId);
  if (!list) return null;

  const add = () => {
    const used = new Set(statuses.map((s) => s.name.toLowerCase()));
    let name = 'New status';
    for (let i = 2; used.has(name.toLowerCase()); i++) name = `New status ${i}`;
    addStatus(listId, { name, category: 'in_progress', color: 'violet' });
  };

  return (
    <Modal
      open
      size="lg"
      onClose={onClose}
      title={`Statuses · ${list.name}`}
      description="Each list owns its status set. Columns on the board follow this order; every list keeps at least one status per category."
      footer={
        <Button variant="primary" onClick={onClose}>
          Done
        </Button>
      }
    >
      <ul className="space-y-2">
        {statuses.map((s) => (
          <StatusRow
            key={s.id}
            status={s}
            usage={Object.values(data.tasks).filter((t) => t.statusId === s.id).length}
          />
        ))}
      </ul>
      <Button variant="ghost" size="sm" className="mt-3" onClick={add}>
        <Plus className="h-3.5 w-3.5" /> Add status
      </Button>
    </Modal>
  );
}

function StatusRow({ status, usage }: { status: Status; usage: number }) {
  const { updateStatus, deleteStatus } = useActions();
  const [name, setName] = useState(status.name);
  const save = (patch: Partial<{ name: string; category: StatusCategory; color: StatusColor }>) => {
    const result = updateStatus(status.id, {
      name: status.name,
      category: status.category,
      color: status.color,
      ...patch,
    });
    if (result.error) setName(status.name);
  };

  return (
    <li className="flex items-center gap-2">
      <div
        className="flex shrink-0 gap-1 rounded-control bg-surface-muted p-1"
        role="radiogroup"
        aria-label={`Color for ${status.name}`}
      >
        {STATUS_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={status.color === color}
            aria-label={color}
            onClick={() => save({ color })}
            className={cn(
              'h-4 w-4 rounded-full transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1',
              STATUS_STYLES[color].dot,
              status.color === color && 'ring-2 ring-ink/70 ring-offset-1',
            )}
          />
        ))}
      </div>
      <div className="relative min-w-0 flex-1">
        <StatusIcon
          category={status.category}
          className={cn('pointer-events-none absolute left-2.5 top-2.5', STATUS_STYLES[status.color].text)}
        />
        <TextInput
          aria-label="Status name"
          value={name}
          maxLength={40}
          className="pl-8"
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name !== status.name && save({ name })}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
      </div>
      <Select
        aria-label="Category"
        value={status.category}
        className="w-36"
        onChange={(e) => save({ category: e.target.value as StatusCategory })}
      >
        {CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {CATEGORY_LABEL[c]}
          </option>
        ))}
      </Select>
      <span className="w-14 shrink-0 text-right text-2xs tabular-nums text-ink-subtle">
        {usage} task{usage === 1 ? '' : 's'}
      </span>
      <IconButton
        label={`Delete ${status.name}`}
        onClick={() => deleteStatus(status.id)}
        className="hover:bg-rose-50 hover:text-rose-600"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </IconButton>
    </li>
  );
}
