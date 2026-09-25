---
name: flowboard-permissions
description: How Flowboard's access control works and how to change it safely. Use when touching src/domain/permissions.ts, grants, visibility, sharing, admin/member behaviour, 403 handling, or anything that lists data across lists (search, assignees, activity, bulk actions), and when adding team grants or permission levels.
---

# Flowboard permissions

## The model today

- **Users**: `role: 'admin' | 'member'`. Admins see and manage everything.
- **Containers**: `visibility: 'public' | 'private'`.
- **Grants**: `{ resourceId, userId, mode: 'allow' | 'deny' }`. There's at most one grant per (resource, user); `setGrant` replaces it, and `mode: null` clears it.

`resolveAccess(data, userId, containerId)` in `src/domain/permissions.ts` decides access for a member looking at container N:

1. An explicit grant on N wins (`allow` → visible, `deny` → hidden).
2. Otherwise, a **private** N is hidden.
3. Otherwise a **public** N inherits its parent's decision. The workspace root is visible to all members.

It returns `{ visible, reason, decidedBy }`. `decidedBy` is the container whose rule applied, and the Sharing dialog uses it to explain the decision ("Denied on 'Q2 Launch'"). **Keep `reason` and `decidedBy` accurate** when you change the rules.

Archived containers (`isArchivedPath`) are never viewable, even by admins. Their guards return `NOT_FOUND`.

## Capabilities matrix

| Action                                                          | Admin  | Member                                                       |
| --------------------------------------------------------------- | ------ | ------------------------------------------------------------ |
| See / open a list                                               | always | `resolveAccess(...).visible`                                 |
| Create / update / delete / move tasks                           | ✓      | only in lists they can see; `moveTask` checks **both** lists |
| Container CRUD, reorder, archive, visibility, sharing, statuses | ✓      | ✗ (`guardManage` → `FORBIDDEN`)                              |

## Guards: always use these

| Guard                                 | Returns              | Use for                                                                 |
| ------------------------------------- | -------------------- | ----------------------------------------------------------------------- |
| `guardViewList(data, userId, listId)` | `StoreError \| null` | Reading or writing anything inside a list                               |
| `guardTask(data, userId, taskId)`     | `Result<Task>`       | Any single-task read or mutation                                        |
| `guardManage(data, userId, action)`   | `StoreError \| null` | Admin-only operations; `action` completes "Only workspace admins can …" |
| `canViewContainer`                    | `boolean`            | Filtering collections (tree, search, pickers)                           |
| `usersWithAccess(data, listId)`       | `User[]`             | Assignee suggestions, mentions, notifications                           |

## Rules for new code

1. **Enforce in `src/domain`.** The UI may hide or disable controls, but the domain must refuse on its own. Add a test that calls the store action directly as a member and expects `FORBIDDEN` (see "member mutation attempts surface a permission toast" in `src/test/App.test.tsx`).
2. **Collections filter; single resources guard.** A list of things (search results, activity, "move to list" options) silently drops what the user can't see. Opening one specific thing returns a 403.
3. **No leaks.** 403 screens, toasts and breadcrumbs must not include the forbidden list's name or contents. `TopBar` only builds breadcrumbs for lists the viewer can open.
4. **User switch must re-evaluate everything.** Selectors take `userId` as an argument and are memoized on it. Never cache access decisions in component state.
5. **Never show hidden ancestors.** The tree (`selectVisibleTree`) contains only visible nodes. Something shared inside a hidden container comes from `selectSharedWithMe` and is rendered under "Shared with me". Breadcrumbs use `visibleAncestorsOf`, never `ancestorsOf`.

## Seed scenario (used by tests; keep it working)

| User           | Sees                                                                                                    | Why                                                                                    |
| -------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Alice (admin)  | everything except the archived Q1 Retro                                                                 | admin                                                                                  |
| Bob (member)   | Backlog, Sprint 14, Security Audit, and Launch Content (under "Shared with me"; Marketing stays hidden) | public inheritance; `allow` on the private Security Audit; `allow` on Launch Content   |
| Carol (member) | Backlog, Campaigns, Launch Content                                                                      | `allow` on the private Marketing space; `deny` on Sprint 14; Security Audit is private |

## Extending the model

### Teams / groups

- Add `teams: Record<ID, { id, name, memberIds }>` and change the grant to `principal: { type: 'user' | 'team', id }`.
- For a node, gather the user's grants from the user and from all their teams. **User grants beat team grants at the same node**, and at equal specificity **deny beats allow**. Specificity (nearest node wins) still comes first.
- `setGrant` gains a `principal` parameter. The Sharing dialog lists teams above users.

### Permission levels

- Replace `mode: 'allow'` with `level: 'view' | 'comment' | 'edit' | 'manage'`, and keep `deny`. `resolveAccess` returns the effective level from the same nearest-rule walk.
- Guards become `guardList(data, userId, listId, required: Level)`. Task mutations need `edit`; structure and sharing need `manage`, which lets admins delegate instead of container CRUD being admin-only.
- Migrate existing grants: `allow` → `edit`. Bump `SCHEMA_VERSION`.

### Performance at scale

- Precompute `accessIndex: Map<userId, Set<containerId>>` and invalidate it on grant, visibility, structure or archive changes. `canViewContainer` then becomes an O(1) lookup. Keep `resolveAccess` for explanations.

### Test checklist for any change here

- Update `src/domain/permissions.test.ts`: admin bypass, public inheritance, private barrier, deny cascade, specific allow beating an inherited deny, archived → `NOT_FOUND`, and the per-user tree labels for Alice, Bob and Carol.
- Run the full suite, including E2E ("Alice vs Bob").
