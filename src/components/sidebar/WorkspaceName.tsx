import { Pencil } from 'lucide-react';
import { useState } from 'react';
import type { Container } from '@/domain/types';
import { cn } from '@/lib/cn';
import { FOCUS_RING } from '@/ui/tokens';
import { RenameInput } from '../ui/RenameInput';

/** The workspace name in the header. Admins can rename it in place (the "U" of workspace CRUD). */
export function WorkspaceName({
  workspace,
  canEdit,
  onRename,
}: {
  workspace: Container;
  canEdit: boolean;
  onRename: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <RenameInput
        initial={workspace.name}
        onDone={(name) => {
          setEditing(false);
          if (name !== null && name !== workspace.name) onRename(name);
        }}
      />
    );
  }

  return (
    <div className="group flex min-w-0 items-center gap-1">
      <p className="truncate text-sm font-semibold leading-tight text-ink">{workspace.name}</p>
      {canEdit && (
        <button
          type="button"
          aria-label="Rename workspace"
          title="Rename workspace"
          onClick={() => setEditing(true)}
          className={cn(
            'flex h-5 w-5 shrink-0 items-center justify-center rounded text-ink-faint opacity-0 transition-opacity hover:bg-line hover:text-ink focus-visible:opacity-100 group-hover:opacity-100',
            FOCUS_RING,
          )}
        >
          <Pencil className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
