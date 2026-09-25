# Flowboard

A mini project-management app for one workspace: a hierarchy of spaces, folders and lists, tasks on a kanban board and in a list view, and a permission model you can switch between users to see. There is no backend. A typed Zustand store, seeded from fixtures, stands in for the API and database.

**Stack:** React 18 · TypeScript (strict) · Vite 5 · Tailwind CSS 3 · Zustand · dnd-kit · Headless UI · Vitest + Testing Library · Playwright

**Stretch goals attempted (2):**

1. **Optimistic UI on drag-and-drop, with rollback on failure**
2. **Client-side search** on task title and description (⌘K or `/`)

The MVP also includes one level of subtasks, simulated pagination in the list view, a status editor, and sharing controls.

---

## 1. Run locally

```bash
npm install
npm run dev          # http://localhost:5173
```

| Command              | What it does                                                                                                                      |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `npm test`           | Unit, store and component tests (Vitest + jsdom). 45 tests.                                                                       |
| `npm run test:e2e`   | Playwright E2E: real drag-and-drop, reload persistence, rollback, Alice vs Bob. Run `npx playwright install chromium` once first. |
| `npm run build`      | Type-check (`tsc -b`), then a production build.                                                                                   |
| `npm run lint`       | ESLint (typescript-eslint + react-hooks).                                                                                         |
| `npm run check:dead` | knip: fails on unused files, exports or dependencies.                                                                             |
| `npm run format`     | Prettier: format everything (`format:check` only verifies). Tailwind classes are sorted by `prettier-plugin-tailwindcss`.         |

Commits are gated by a **pre-commit hook** (husky + lint-staged). It formats the staged files with Prettier, then lints the staged `.ts`/`.tsx` files and rejects the commit on any ESLint error or warning. The hook installs automatically on `npm install` (the `prepare` script).

**Editor setup:** opening the repo in VS Code prompts you to install the recommended extensions (ESLint, Prettier, Tailwind CSS IntelliSense, Vitest, Playwright; see `.vscode/extensions.json`). The workspace settings turn on format-on-save and ESLint auto-fix on save.

### 30-second demo: Alice vs Bob

1. The app opens as **Alice (admin)**. The sidebar shows everything, including the private **Marketing** space and the private **Security Audit** list.
2. Open **Marketing › Brand Refresh › Campaigns**.
3. Use the **"Viewing as"** switcher in the top right to pick **Bob**. The board turns into a **403** screen straight away. In the tree, Campaigns disappears, Marketing and Brand Refresh turn into greyed, locked path segments, and **Launch Content** (explicitly shared with Bob) stays.
4. Press ⌘K and search "launch". Bob gets no Campaigns results, because search is permission-filtered too.
5. Open the **⋯** menu on any tree item as Bob. Every action is disabled and labelled "Admins only".
6. Switch to **Carol**. She sees Marketing, but not Sprint 14 (she has an explicit deny) or Security Audit (private).

To see a rollback, open the user menu, choose **Demo controls → Simulate save failures**, and drag a card. It moves immediately, shows a spinner, then snaps back with a "Save failed" toast.

---

## 2. Architecture

```mermaid
flowchart LR
  subgraph UI["React components (Tailwind only)"]
    SB[Sidebar / SidebarTree<br/>dnd-kit sibling reorder]
    TB[TopBar + UserSwitcher]
    LS[ListScreen<br/>skeleton · 403 · empty]
    BV[BoardView<br/>dnd-kit kanban]
    LV[ListView<br/>sort + pagination]
    TD[TaskDrawer<br/>Headless UI Dialog]
    SP[SearchPalette ⌘K]
    DLG[Create / Share / Statuses / Archive dialogs]
    TO[Toaster]
  end

  subgraph Store["Client data layer"]
    AS["appStore (Zustand)<br/>data · currentUserId · boot · loadingListId · pendingTaskIds"]
    TR["transport.ts<br/>fake latency / failure"]
    PE["persistence.ts<br/>localStorage"]
    UI2["ui.ts / toasts.ts<br/>ephemeral UI state"]
  end

  subgraph Domain["Pure domain (framework-free, unit tested)"]
    PM["permissions.ts<br/>resolveAccess · guards"]
    SEL["selectors.ts / tree.ts<br/>board · list page · detail · search · tree"]
    MUT["tasks.ts · containers.ts · statuses.ts<br/>(state, actor, input) → Result"]
  end

  UI -- "useAppStore(selector)" --> AS
  UI -- "selectX(data, userId, …)" --> SEL
  UI -- "actions.*()" --> AS
  AS --> MUT
  MUT --> PM
  SEL --> PM
  AS -- "moveTask: await save" --> TR
  AS -- subscribe --> PE
  AS -- "onError → toast" --> TO
  URL["hash router<br/>#/list/:id/:view?task=:id"] <--> LS & TD
```

**Why the layers are split this way**

- **`src/domain/`** is plain TypeScript with no React and no Zustand. Every mutation is a pure function `(state, actorId, input, now) → { data: { state, value } } | { error }`. Every read is a selector `(state, userId, …) → { data } | { error }`. That makes the permission rules easy to test in isolation: that's where most of the tests are.
- **`src/store/appStore.ts`** is a thin Zustand wrapper. Each action calls a domain function. On success it commits the new state; on failure it reports once through `onError`, which the app turns into a toast. Components never check a result just to show an error.
- **`src/store/transport.ts`** fakes the network: latency for loading skeletons, plus an optional failure switch that exercises rollback.
- **Hash routing** (`#/list/<id>/<board|list>?task=<id>`) makes every list and task deep-linkable. It also makes "open a resource you can't access" reproducible: paste Alice's URL while viewing as Bob.

```
src/
├── domain/        types · permissions · tree · selectors · tasks · containers · statuses · ordering
├── data/seed.ts   fixtures (stable ids, dates relative to "now")
├── store/         appStore · transport · persistence · toasts · ui · hooks · context
├── components/    sidebar/ · board/ · list/ · task/ · dialogs/ · search/ · layout/ · ui/
├── ui/tokens.ts   status / priority / avatar class maps (single source of truth)
├── lib/           router · dates · cn (clsx + tailwind-merge)
└── test/          component tests + render helper
e2e/               Playwright specs
CLAUDE.md          contract for AI assistants: invariants, where code goes, definition of done
.claude/skills/    project skills: flowboard-feature (+ roadmap), flowboard-permissions, flowboard-ui, flowboard-verify
```

---

## 3. Data model

All data lives in one normalized, serializable `DataState` (`Record<id, entity>` per type). This is the stand-in for a database, and it's what gets persisted.

```ts
Container { id, name, type: 'workspace'|'space'|'folder'|'list', parentId, position,
            visibility: 'public'|'private', archivedAt, createdAt, updatedAt }
Status    { id, listId, name, category: 'todo'|'in_progress'|'done', color, position }
Task      { id, title, description, primaryListId, statusId, priority, assigneeIds[],
            dueDate, position, parentTaskId, createdBy, createdAt, updatedAt }
Grant     { id, resourceId, userId, mode: 'allow'|'deny' }
User      { id, name, email, role: 'admin'|'member', title, avatarColor }
```

- **Hierarchy.** `CHILD_TYPE` enforces workspace → space → folder → list. Lists hold tasks, not containers, so creating a child under a list returns `VALIDATION`. Siblings are ordered by `position`.
- **Positions** are integers spaced by 1000. A reorder or drop re-indexes only the affected sibling group or column (`moveId` + `reindex`). This keeps positions dense and deterministic, with no fractional-index drift. For a task, `position` is its order within its status column.
- **Statuses** belong to a list. A task's `statusId` must belong to its `primaryListId`, and every mutation validates this. When a task moves to another list, its status is re-mapped by **same name → same category → first status**, and its subtasks move with it.
- **One assignee per task.** This is a deliberate product decision: every task has a single owner, which keeps responsibility clear. The field stays `assigneeIds: ID[]` so the shape matches the brief, but the store enforces at most one (`MAX_ASSIGNEES = 1` in `tasks.ts`; more returns `VALIDATION`). Allowing multiple assignees again means changing that one constant and the picker. The drawer's picker searches only people who can see the list, and choosing someone replaces the current assignee.
- **Subtasks** are one level deep (`parentTaskId`). A subtask's parent must be a top-level task in the same list. Subtasks don't appear as board cards. They show as `2/3` progress on the parent card and as a checklist in the drawer.
- **Soft delete is container archiving.** `archivedAt` hides a container and its whole subtree from every selector, and its tasks become `NOT_FOUND`. Nothing is destroyed: admins restore it from **Archived** at the bottom of the sidebar. Tasks, by contrast, are **hard-deleted** (with an inline confirm), and deleting a parent also deletes its subtasks. I chose this split because containers carry structure and grants that are costly to rebuild, while tasks are cheap to recreate.
- **Error shape.** Every store call returns `{ data }` or `{ error: { code, message } }`, where `code` is one of `FORBIDDEN` (403), `NOT_FOUND`, `VALIDATION`, `CONFLICT` or `NETWORK`.
- **Persistence (optional, enabled).** The data graph, the selected user and the failure toggle are saved to `localStorage` (`flowboard:v1`, debounced 250 ms, schema-versioned). **Reset demo data** in the user menu restores the seed. I persisted by default because a drag that is lost on refresh feels broken in a demo.

---

## 4. How permissions are enforced

**Rules** (`src/domain/permissions.ts → resolveAccess`):

1. **Admins** see and edit everything.
2. For a member looking at container _N_: an **explicit grant** on _N_ decides the outcome (`allow` means visible, `deny` means hidden).
3. Otherwise, if _N_ is **private**, it's hidden.
4. Otherwise _N_ is **public**, and it **inherits** its parent's decision. The workspace root is visible to all members.

In short: the nearest explicit rule wins, private is a barrier, and deny cascades down unless a more specific allow overrides it. The result also records `decidedBy` (which container's rule applied). The **Sharing** dialog uses that to explain each person's access, for example "No access · 'Marketing' is private" or "Can view · Allowed on 'Marketing'".

**Where it's enforced** — the store and selectors, not the UI:

| Layer                                               | Enforcement                                                                                                                                                                                                        |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `selectVisibleTree`                                 | Returns only nodes the user can see, plus **restricted** path-only ancestors needed to reach an item shared deeper down (e.g. Bob → Marketing › Brand Refresh › Launch Content). Restricted nodes can't be opened. |
| `selectBoard`, `selectListPage`, `selectTaskDetail` | Return `{ error: { code: 'FORBIDDEN' } }` rather than data. The UI renders that as the 403 screen, or as a 403 panel inside the drawer.                                                                            |
| `searchTasks`                                       | Only searches lists the user can open.                                                                                                                                                                             |
| Every task mutation                                 | `guardViewList` or `guardTask` runs first. Moving a task to another list checks **both** lists.                                                                                                                    |
| Every container, status or grant mutation           | `guardManage`: admin-only.                                                                                                                                                                                         |
| Assignee picker                                     | `usersWithAccess(listId)`, so you can't assign someone who can't see the list.                                                                                                                                     |
| Breadcrumbs                                         | Built only for lists the viewer can open, so a forbidden list's name never leaks.                                                                                                                                  |

Switching users only changes `currentUserId`. Every selector takes the user as an argument and is memoized on `(data, userId)`, so the tree, board, drawer and search re-evaluate on the next render with no extra wiring. Hidden or disabled buttons are a courtesy on top: the store would refuse anyway. There's a component test that calls `renameContainer` directly as Bob and asserts the 403 toast.

**How I'd extend the model**

- **Teams / groups.** Add `Grant.principal: { type: 'user' | 'team', id }` and resolve a user's grants as the union over their teams, with user grants taking precedence at the same node, and deny beating allow at equal specificity.
- **Capabilities, not just visibility.** Replace `allow` with levels such as `view < comment < edit < manage`, resolved with the same nearest-rule walk. Container management would then no longer have to be admin-only.
- **Performance.** At scale, precompute an access index (`userId → Set<containerId>`) that is invalidated on grant, visibility or structure changes, instead of walking ancestors on each check. On a server, the same pure functions would move behind the API as the single source of truth, and the client would keep them only for optimistic UX.
- **Task-level sharing.** Allow a grant on a task (guests), checked before the list rule.

---

## 5. Trade-offs, and what I'd do in week 2

**Deliberate cuts**

- **Container mutations are admin-only.** The brief only requires that members can edit tasks, and this keeps the model easy to explain. A capabilities model (above) would lift it.
- **Only drag-and-drop is optimistic and asynchronous.** Other mutations commit synchronously to the local store, which is honest for a client-only app. In `moveTask`, the rollback restores only the records that move touched, and only if nothing has changed them since, so a newer move beats an older failure.
- **Native `<select>` and `<input type="date">` in the drawer.** They're accessible and robust, but less polished than custom Headless UI listboxes and date pickers.
- **Status editing** supports add, rename, recolour, change category and delete. It doesn't support reordering columns by drag. Deleting a status that tasks still use is refused with `CONFLICT` rather than silently re-mapping those tasks.
- **Single assignee** instead of the brief's multi-assignee array (see Data model). Collaborators on a task would come back as watchers or subscribers rather than co-owners.
- **Search is a palette**, not a per-view filter. **Pagination** is offset-based "load more" over in-memory data (page size 10; Backlog has 12 tasks so you can see it).
- **Desktop-first.** The layout has a 960 px minimum width, and there's no dark mode (both out of scope).
- **Bundle** is about 157 kB gzipped, mostly React DOM and Headless UI. I didn't do route-level code splitting.

**Week 2**

1. An activity feed built from the same mutation pipeline (each `commit` emits an event), and undo for deletes.
2. Permission levels (view / edit / manage) plus team grants, and an access index.
3. Drag tasks onto sidebar lists to move them, and drag to reorder kanban columns.
4. Bulk select plus bulk status and assignee changes in the list view.
5. Virtualized columns and rows for large lists, and moving positions to fractional indexing to cut write amplification when a real backend arrives.
6. Storybook for the card, pill and badge primitives, visual regression tests, and an axe accessibility pass in Playwright.
7. A deployed preview (Vercel) with the E2E suite running in CI.

---

## 6. AI usage log

**Tool:** Claude Code (Claude Opus), used as a pair programmer throughout: scaffolding, the domain and store layers, components, tests and this README. I reviewed every change, and verified the UI by driving the running app with Playwright screenshots rather than trusting generated code.

**Where it helped most:** the boilerplate-heavy parts (Tailwind tokens, dnd-kit multi-container wiring, Headless UI dialogs), generating seed fixtures with a deliberate permission scenario, and writing the first draft of the test matrix.

**Where I corrected it:** see [AI_USAGE.md](./AI_USAGE.md) for specifics. Examples include a class-merge bug that broke a dialog's layout, a JS auto-grow that broke the no-inline-style rule, a non-existent Tailwind class, a permission "reason" that threw away information, and a flaky E2E drag helper.

---

## 7. Styling rules and the `style=` exceptions

- All styling is Tailwind utility classes in JSX. The only stylesheet is `src/index.css`, which contains just the three `@tailwind` directives. There are no CSS modules, no `@apply`, and no CSS-in-JS.
- **Theme tokens** in `tailwind.config.ts`: `colors` (brand scale, `ink`, `canvas`, `surface`, `line`), `fontFamily` (Inter), `borderRadius` (`control`, `card`, `panel`), `boxShadow` (`card`, `card-hover`, `drag`, `pop`, `drawer`, `focus`), plus a few keyframes.
- **Consistent semantics.** Status, priority and avatar colours come from a single map (`src/ui/tokens.ts`), used by kanban cards, list rows, the drawer and search results alike.
- **`cn()`** is `clsx` plus `tailwind-merge`, configured with the custom tokens so that, for example, `text-2xs` isn't mistaken for a text colour.

**DnD `style=` exceptions (the only two in the codebase):**

| File                                                      | Why                                                                                                                       |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `src/components/board/TaskCard.tsx` (`SortableTaskCard`)  | dnd-kit's `useSortable` provides a per-frame `transform` and `transition` that must be applied inline to the moving node. |
| `src/components/sidebar/SidebarTree.tsx` (`SortableItem`) | Same, for reordering tree siblings.                                                                                       |

Two libraries also set inline positioning themselves (I didn't write it): dnd-kit's `DragOverlay`, and Headless UI's anchored `MenuItems`, which uses floating-ui.
