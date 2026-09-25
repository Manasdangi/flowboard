import { byPosition } from './ordering';
import { canViewContainer, isArchivedPath } from './permissions';
import type { Container, ContainerType, DataState, ID } from './types';

export interface TreeNode {
  container: Container;
  children: TreeNode[];
}

/** Which container type may live directly under which. Lists hold tasks only. */
export const CHILD_TYPE: Record<ContainerType, ContainerType | null> = {
  workspace: 'space',
  space: 'folder',
  folder: 'list',
  list: null,
};

export function childrenOf(data: DataState, parentId: ID, opts: { includeArchived?: boolean } = {}): Container[] {
  return Object.values(data.containers)
    .filter((c) => c.parentId === parentId && (opts.includeArchived || !c.archivedAt))
    .sort(byPosition);
}

/** A container and its visible descendants, descending only through containers the user can see. */
function visibleSubtree(data: DataState, userId: ID, parentId: ID): TreeNode[] {
  return childrenOf(data, parentId)
    .filter((c) => canViewContainer(data, userId, c.id))
    .map((container) => ({ container, children: visibleSubtree(data, userId, container.id) }));
}

/**
 * The sidebar tree for a user: only containers they can see. A hidden
 * container hides its whole subtree here; anything shared with the user
 * inside it appears in `selectSharedWithMe` instead. Archived subtrees are dropped.
 */
export function selectVisibleTree(data: DataState, userId: ID): TreeNode[] {
  return visibleSubtree(data, userId, data.workspaceId);
}

/**
 * Containers the user can see whose parent they can't (e.g. an allow grant
 * on a list inside a private space). Shown under "Shared with me", so the
 * hidden parents are never revealed, not even by name.
 */
export function selectSharedWithMe(data: DataState, userId: ID): TreeNode[] {
  const out: TreeNode[] = [];
  const walk = (parentId: ID, parentVisible: boolean) => {
    for (const container of childrenOf(data, parentId)) {
      const visible = canViewContainer(data, userId, container.id);
      if (visible && !parentVisible) out.push({ container, children: visibleSubtree(data, userId, container.id) });
      walk(container.id, visible);
    }
  };
  walk(data.workspaceId, true);
  return out;
}

/** Flat list of lists the user can open (main tree first, then shared), in tree order. */
export function selectVisibleLists(data: DataState, userId: ID): Container[] {
  const out: Container[] = [];
  const walk = (nodes: TreeNode[]) => {
    for (const n of nodes) {
      if (n.container.type === 'list') out.push(n.container);
      walk(n.children);
    }
  };
  walk(selectVisibleTree(data, userId));
  walk(selectSharedWithMe(data, userId));
  return out;
}

/** Root → node (excluding the workspace). Use `visibleAncestorsOf` for anything shown to a user. */
export function ancestorsOf(data: DataState, id: ID): Container[] {
  const path: Container[] = [];
  let node: Container | undefined = data.containers[id];
  while (node && node.type !== 'workspace') {
    path.unshift(node);
    node = node.parentId ? data.containers[node.parentId] : undefined;
  }
  return path;
}

/** Breadcrumb path for a user: ancestors they can't see are left out, so their names never leak. */
export function visibleAncestorsOf(data: DataState, userId: ID, id: ID): Container[] {
  return ancestorsOf(data, id).filter((c) => canViewContainer(data, userId, c.id));
}

export function descendantIds(data: DataState, id: ID): ID[] {
  const out: ID[] = [];
  const walk = (parentId: ID) => {
    for (const c of Object.values(data.containers)) {
      if (c.parentId === parentId) {
        out.push(c.id);
        walk(c.id);
      }
    }
  };
  walk(id);
  return out;
}

/** Admin-only view: top-most archived containers (restoring one restores its subtree). */
export function selectArchived(data: DataState): Container[] {
  return Object.values(data.containers)
    .filter((c) => c.archivedAt && !(c.parentId && isArchivedPath(data, c.parentId)))
    .sort((a, b) => (b.archivedAt ?? '').localeCompare(a.archivedAt ?? ''));
}
