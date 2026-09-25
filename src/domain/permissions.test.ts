import { describe, expect, it } from 'vitest';
import { createSeed, SEED_IDS } from '@/data/seed';
import { canViewContainer, guardTask, guardViewList, resolveAccess, usersWithAccess } from './permissions';
import { selectSharedWithMe, selectVisibleLists, selectVisibleTree, visibleAncestorsOf, type TreeNode } from './tree';
import { searchTasks, selectBoard, selectListPage, selectTaskDetail } from './selectors';
import type { DataState } from './types';

const { users: U, lists: L, spaces: S, folders: F } = SEED_IDS;
const data = createSeed(new Date('2026-06-01T12:00:00Z'));

/** Flatten a tree to its container names, depth-first, for readable assertions. */
function labels(nodes: TreeNode[]): string[] {
  return nodes.flatMap((n) => [n.container.name, ...labels(n.children)]);
}

const withGrants = (extra: DataState['grants']): DataState => ({ ...data, grants: { ...data.grants, ...extra } });

describe('resolveAccess', () => {
  it('lets admins see everything, including private containers without grants', () => {
    expect(resolveAccess(data, U.alice, S.marketing)).toMatchObject({ visible: true, reason: 'admin' });
    expect(resolveAccess(data, U.alice, L.security).visible).toBe(true);
  });

  it('shows public containers to members through inheritance', () => {
    expect(resolveAccess(data, U.bob, L.backlog)).toMatchObject({ visible: true, reason: 'workspace' });
  });

  it('hides private containers from members without an allow grant', () => {
    expect(resolveAccess(data, U.carol, L.security)).toMatchObject({ visible: false, reason: 'private' });
    expect(resolveAccess(data, U.bob, S.marketing)).toMatchObject({ visible: false, reason: 'private' });
  });

  it('honours an explicit allow on a private container', () => {
    expect(resolveAccess(data, U.bob, L.security)).toMatchObject({ visible: true, reason: 'grant-allow' });
  });

  it('honours an explicit deny on a public container', () => {
    expect(resolveAccess(data, U.carol, L.sprint)).toMatchObject({ visible: false, reason: 'grant-deny' });
  });

  it('inherits a space-level allow down to public children', () => {
    expect(resolveAccess(data, U.carol, L.campaigns)).toMatchObject({
      visible: true,
      reason: 'grant-allow',
      decidedBy: S.marketing,
    });
  });

  it('inherits a deny down to public children, but a more specific allow wins', () => {
    const denied = withGrants({ g1: { id: 'g1', resourceId: F.q2, userId: U.bob, mode: 'deny' } });
    expect(canViewContainer(denied, U.bob, L.backlog)).toBe(false);
    // Bob's existing allow on Security Audit is more specific than the folder deny.
    expect(canViewContainer(denied, U.bob, L.security)).toBe(true);
  });

  it('never exposes archived containers, even to admins', () => {
    expect(canViewContainer(data, U.alice, L.retro)).toBe(false);
    expect(guardViewList(data, U.alice, L.retro)?.code).toBe('NOT_FOUND');
  });
});

describe('selectVisibleTree', () => {
  it('returns the full (non-archived) tree for the admin', () => {
    expect(labels(selectVisibleTree(data, U.alice))).toEqual([
      'Engineering',
      'Q2 Launch',
      'Backlog',
      'Sprint 14',
      'Security Audit',
      'Marketing',
      'Brand Refresh',
      'Campaigns',
      'Launch Content',
    ]);
  });

  it('filters Bob’s tree to only nodes he can see — no hidden private parents', () => {
    expect(labels(selectVisibleTree(data, U.bob))).toEqual([
      'Engineering',
      'Q2 Launch',
      'Backlog',
      'Sprint 14',
      'Security Audit',
    ]);
  });

  it('puts items shared inside hidden containers under "Shared with me", without their parents', () => {
    expect(labels(selectSharedWithMe(data, U.bob))).toEqual(['Launch Content']);
    expect(selectSharedWithMe(data, U.alice)).toEqual([]);
    expect(selectSharedWithMe(data, U.carol)).toEqual([]);
  });

  it('never reveals hidden ancestors in breadcrumbs', () => {
    expect(visibleAncestorsOf(data, U.bob, L.launch).map((c) => c.name)).toEqual(['Launch Content']);
    expect(visibleAncestorsOf(data, U.alice, L.launch).map((c) => c.name)).toEqual([
      'Marketing',
      'Brand Refresh',
      'Launch Content',
    ]);
    expect(selectTaskDetail(data, U.bob, 't_lc_1').data?.path.map((c) => c.name)).toEqual(['Launch Content']);
  });

  it('filters Carol’s tree by her different grants', () => {
    expect(labels(selectVisibleTree(data, U.carol))).toEqual([
      'Engineering',
      'Q2 Launch',
      'Backlog',
      'Marketing',
      'Brand Refresh',
      'Campaigns',
      'Launch Content',
    ]);
  });

  it('drops a subtree entirely when nothing in it is visible', () => {
    const noLaunch = withGrants({});
    delete noLaunch.grants.g_bob_launch;
    expect(labels(selectVisibleTree(noLaunch, U.bob))).not.toContain('Marketing');
    expect(selectSharedWithMe(noLaunch, U.bob)).toEqual([]);
  });

  it('reflects visibility changes immediately', () => {
    const publicMarketing: DataState = {
      ...data,
      containers: { ...data.containers, [S.marketing]: { ...data.containers[S.marketing], visibility: 'public' } },
    };
    expect(labels(selectVisibleTree(publicMarketing, U.bob))).toContain('Campaigns');
  });

  it('lists only openable lists, including shared ones', () => {
    expect(selectVisibleLists(data, U.carol).map((l) => l.id)).toEqual([L.backlog, L.campaigns, L.launch]);
    expect(selectVisibleLists(data, U.bob).map((l) => l.id)).toEqual([L.backlog, L.sprint, L.security, L.launch]);
  });
});

describe('task access through selectors', () => {
  it('returns a 403 for a board the user cannot see', () => {
    expect(selectBoard(data, U.bob, L.campaigns).error).toMatchObject({ code: 'FORBIDDEN' });
    expect(selectBoard(data, U.carol, L.sprint).error).toMatchObject({ code: 'FORBIDDEN' });
    expect(selectBoard(data, U.bob, L.security).data?.taskCount).toBe(4);
  });

  it('returns a 403 for list pages and task details in denied lists', () => {
    const sort = { key: 'manual', dir: 'asc' } as const;
    expect(selectListPage(data, U.carol, L.sprint, { sort }).error?.code).toBe('FORBIDDEN');
    expect(selectTaskDetail(data, U.bob, 't_cmp_4').error?.code).toBe('FORBIDDEN');
    expect(guardTask(data, U.carol, 't_sp_1').error?.code).toBe('FORBIDDEN');
    expect(selectTaskDetail(data, U.carol, 't_cmp_4').data?.task.title).toBe('Product Hunt launch post');
  });

  it('search never leaks tasks from lists the user cannot see', () => {
    expect(searchTasks(data, U.alice, 'launch').map((h) => h.task.id)).toContain('t_cmp_4');
    expect(searchTasks(data, U.bob, 'launch').map((h) => h.task.id)).not.toContain('t_cmp_4');
    expect(searchTasks(data, U.bob, 'Product Hunt')).toEqual([]);
  });

  it('only offers assignees who can see the list', () => {
    expect(usersWithAccess(data, L.security).map((u) => u.id)).toEqual([U.alice, U.bob]);
    expect(usersWithAccess(data, L.sprint).map((u) => u.id)).toEqual([U.alice, U.bob]);
  });
});
