import { Archive, Lock, MoreHorizontal, Palette, Pencil, Plus, Share2 } from 'lucide-react';
import { CHILD_TYPE } from '@/domain/tree';
import type { Container } from '@/domain/types';
import { cn } from '@/lib/cn';
import { useActions, useCurrentUser } from '@/store/hooks';
import { uiStore } from '@/store/ui';
import { FOCUS_RING } from '@/ui/tokens';
import { Menu, MenuAction, MenuButton, MenuDivider, MenuLabel, MenuPanel } from '../ui/Menu';

/**
 * Per-container actions. Members still get clickable items (marked "Admins only"):
 * clicking sends the real store action, whose permission guard answers with a
 * FORBIDDEN error → "Permission denied" toast. That makes the store-level 403
 * visible in the UI instead of hiding it behind disabled buttons.
 */
export function ContainerMenu({
  container,
  isAdmin,
  onRename,
}: {
  container: Container;
  isAdmin: boolean;
  onRename: () => void;
}) {
  const actions = useActions();
  const user = useCurrentUser();
  const child = CHILD_TYPE[container.type];
  const open = uiStore.getState().openDialog;

  // Admins open the real UI; members attempt the mutation and get the store's 403.
  const attempt = {
    create: () =>
      isAdmin
        ? open({ kind: 'create', parentId: container.id })
        : actions.createContainer({ parentId: container.id, name: `New ${child}` }),
    rename: () => (isAdmin ? onRename() : actions.renameContainer(container.id, container.name)),
    share: () =>
      isAdmin
        ? open({ kind: 'share', containerId: container.id })
        : actions.setGrant({ resourceId: container.id, userId: user.id, mode: 'allow' }),
    statuses: () =>
      isAdmin
        ? open({ kind: 'statuses', listId: container.id })
        : actions.addStatus(container.id, { name: 'New status', category: 'in_progress', color: 'violet' }),
    archive: () =>
      isAdmin ? open({ kind: 'archive', containerId: container.id }) : actions.archiveContainer(container.id),
  };

  const hint = isAdmin ? undefined : (
    <span className="inline-flex items-center gap-1">
      <Lock className="h-2.5 w-2.5" aria-hidden /> Admins only
    </span>
  );

  return (
    <Menu>
      <MenuButton
        aria-label={`${container.name} options`}
        className={cn(
          'flex h-6 w-6 items-center justify-center rounded text-ink-subtle hover:bg-line hover:text-ink data-[open]:bg-line data-[open]:text-ink',
          FOCUS_RING,
        )}
      >
        <MoreHorizontal className="h-3.5 w-3.5" />
      </MenuButton>
      <MenuPanel anchor="bottom start" className="w-64">
        <MenuLabel>{container.type}</MenuLabel>
        {child && (
          <MenuAction icon={<Plus className="h-3.5 w-3.5" />} muted={!isAdmin} hint={hint} onClick={attempt.create}>
            New {child}
          </MenuAction>
        )}
        <MenuAction
          icon={<Pencil className="h-3.5 w-3.5" />}
          muted={!isAdmin}
          hint={isAdmin ? 'F2' : hint}
          onClick={attempt.rename}
        >
          Rename
        </MenuAction>
        <MenuAction icon={<Share2 className="h-3.5 w-3.5" />} muted={!isAdmin} hint={hint} onClick={attempt.share}>
          Sharing & visibility
        </MenuAction>
        {container.type === 'list' && (
          <MenuAction
            icon={<Palette className="h-3.5 w-3.5" />}
            muted={!isAdmin}
            hint={hint}
            onClick={attempt.statuses}
          >
            Edit statuses
          </MenuAction>
        )}
        <MenuDivider />
        <MenuAction
          icon={<Archive className="h-3.5 w-3.5" />}
          danger={isAdmin}
          muted={!isAdmin}
          hint={hint}
          onClick={attempt.archive}
        >
          Archive
        </MenuAction>
      </MenuPanel>
    </Menu>
  );
}
