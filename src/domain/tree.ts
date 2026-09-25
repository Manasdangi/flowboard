import { byPosition } from './ordering';
import { canViewContainer, isArchivedPath } from './permissions';
import type { Container, ContainerType, DataState, ID } from './types';

export interface TreeNode {
  container: Container;
  children: TreeNode[];
  /**
   * The user can't open this node itself, but can see something inside it
   * (e.g. an allow-grant on a list under a private space). Rendered as a
   * locked, non-interactive path segment.
   */
  restricted: boolean;
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

/**
 * The sidebar tree for a user: only containers they can see, plus restricted
 * ancestors needed to reach them. Archived subtrees are dropped entirely.
 */
export function selectVisibleTree(data: DataState, userId: ID): TreeNode[] {
  const build = (parentId: ID): TreeNode[] => {
    const out: TreeNode[] = [];
    for (const container of childrenOf(data, parentId)) {
      const children = build(container.id);
      const visible = canViewContainer(data, userId, container.id);
      if (visible || children.length > 0) out.push({ container, children, restricted: !visible });
    }
    return out;
  };
  return build(data.workspaceId);
}

/** Flat list of lists the user can open, in tree order. */
export function selectVisibleLists(data: DataState, userId: ID): Container[] {
  const out: Container[] = [];
  const walk = (nodes: TreeNode[]) => {
    for (const n of nodes) {
      if (n.container.type === 'list' && !n.restricted) out.push(n.container);
      walk(n.children);
    }
  };
  walk(selectVisibleTree(data, userId));
  return out;
}

/** Root → node (excluding the workspace). */
export function ancestorsOf(data: DataState, id: ID): Container[] {
  const path: Container[] = [];
  let node: Container | undefined = data.containers[id];
  while (node && node.type !== 'workspace') {
    path.unshift(node);
    node = node.parentId ? data.containers[node.parentId] : undefined;
  }
  return path;
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
