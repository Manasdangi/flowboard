import { Archive, MoreHorizontal, Palette, Pencil, Plus, Share2 } from 'lucide-react';
import { CHILD_TYPE } from '@/domain/tree';
import type { Container } from '@/domain/types';
import { cn } from '@/lib/cn';
import { uiStore } from '@/store/ui';
import { FOCUS_RING } from '@/ui/tokens';
import { Menu, MenuAction, MenuButton, MenuDivider, MenuLabel, MenuPanel } from '../ui/Menu';

/**
 * Per-container actions. Members see the menu with everything disabled so the
 * permission model is discoverable ("Admins only") — the store enforces it anyway.
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
  const child = CHILD_TYPE[container.type];
  const open = uiStore.getState().openDialog;
  const hint = isAdmin ? undefined : 'Admins only';
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
          <MenuAction
            icon={<Plus className="h-3.5 w-3.5" />}
            disabled={!isAdmin}
            hint={hint}
            onClick={() => open({ kind: 'create', parentId: container.id })}
          >
            New {child}
          </MenuAction>
        )}
        <MenuAction
          icon={<Pencil className="h-3.5 w-3.5" />}
          disabled={!isAdmin}
          hint={isAdmin ? 'F2' : hint}
          onClick={onRename}
        >
          Rename
        </MenuAction>
        <MenuAction
          icon={<Share2 className="h-3.5 w-3.5" />}
          disabled={!isAdmin}
          hint={hint}
          onClick={() => open({ kind: 'share', containerId: container.id })}
        >
          Sharing & visibility
        </MenuAction>
        {container.type === 'list' && (
          <MenuAction
            icon={<Palette className="h-3.5 w-3.5" />}
            disabled={!isAdmin}
            hint={hint}
            onClick={() => open({ kind: 'statuses', listId: container.id })}
          >
            Edit statuses
          </MenuAction>
        )}
        <MenuDivider />
        <MenuAction
          icon={<Archive className="h-3.5 w-3.5" />}
          danger
          disabled={!isAdmin}
          hint={hint}
          onClick={() => open({ kind: 'archive', containerId: container.id })}
        >
          Archive
        </MenuAction>
      </MenuPanel>
    </Menu>
  );
}
