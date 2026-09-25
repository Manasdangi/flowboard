# Flowboard roadmap: agreed designs for upcoming features

Each entry lists the data, rules, store, UI and tests needed, so it can be implemented with the `flowboard-feature` recipe without redesigning. Stretch goals already shipped: **client-side search** and **optimistic DnD with rollback**. The brief allows at most two stretch goals, so anything below from the brief's stretch list is extra.

---

## 1. Activity feed ("Alice moved _X_ to Done")

- **Data**: add `activity: Record<ID, ActivityEvent>` to `DataState`, where `ActivityEvent = { id, at, actorId, listId, taskId?, kind, meta }`. `kind` is one of `task.created | task.updated | task.moved | task.deleted | container.*`. `meta` holds a small diff, e.g. `{ from: statusId, to: statusId }`.
- **Rules**: record events in one place. Wrap `commit` in `appStore.ts` so each successful action appends an event built from `(action name, input, value)`. Domain mutations stay unaware of the feed. A rolled-back `moveTask` must append a compensating event or remove its own event.
- **Read**: add `selectActivity(data, userId, { listId?, limit })` in `selectors.ts`. It **must drop events whose list the user can't see**, and events for tasks in archived lists.
- **UI**: a collapsible panel on the list screen, plus a per-task "Activity" section in `TaskDrawer`. Render with `formatRelative`.
- **Tests**: Bob can't see events from Campaigns; a rollback leaves no "moved" event.
- **Persistence**: bump `SCHEMA_VERSION`. Cap stored events (e.g. the last 500).

## 2. Bulk update (multi-select → status / assignee)

- **UI state**: selection lives in `store/ui.ts` as `selectedTaskIds: Set<ID>`, scoped to the current list and cleared on list switch or user switch. Checkboxes go in `ListView` rows, with Shift-click for range selection.
- **Domain**: `bulkUpdateTasks(data, actorId, { taskIds, patch }, now)` validates **every** task with `guardTask` first, then applies the patch all-or-nothing. On any failure it returns the first error and leaves no partial writes.
- **Store**: a single `commit` gives a single persisted change and a single toast.
- **UI**: a sticky action bar ("3 selected · Status ▾ · Assignee ▾ · Clear"). The assignee menu reuses the `usersWithAccess` scoping.
- **Tests**: a mixed-permission selection fails atomically; the one-assignee rule still holds.

## 3. Keyboard shortcuts

- **Hook**: `src/lib/shortcuts.ts` exports `useShortcut(combo, handler, { enabled })`. Ignore key events that come from inputs, textareas, selects or content-editable elements (copy the check in `SearchPalette.tsx`).
- **Initial set**: `c` = new task in the current list; `b` / `l` = board / list view; `j` / `k` = move focus between cards or rows; `Enter` = open; `e` = edit title in the drawer; `?` = cheat-sheet modal. `⌘K` and `/` already exist.
- **Discoverability**: `Kbd` hints in tooltips and in the `?` modal.
- **Tests**: shortcuts don't fire while typing in the title field.

## 4. Deployed preview

- Vercel: build command `npm run build`, output `dist/`. Hash routing means no rewrite rules are needed.
- Put the URL at the top of `README.md`.

## 5. Storybook for key components

- `@storybook/react-vite`. Stories for `TaskCardBody`, `StatusPill`, `PriorityBadge`, `DueDate`, `AvatarStack`, `EmptyState` and `AssigneePicker`.
- Import `src/index.css` in `.storybook/preview.ts` so the Tailwind tokens apply.
- Wrap in `StoreProvider` with `createAppStore({ ready: true, settings: { latencyMs: 0 } })` for components that read the store.

## 6. Team grants and permission levels

See the `flowboard-permissions` skill, section "Extending the model". Don't start this without reading it.

## 7. Smaller follow-ups

- **Drag a task onto a sidebar list** to move it. Make sidebar list rows droppable in a shared `DndContext`, then call `moveTask({ taskId, toListId })`. The store already checks both lists.
- **Reorder kanban columns**: add `reorderStatus` in `statuses.ts` (admin-only, `moveId` + `reindex`), with a horizontal `SortableContext` around the columns.
- **Undo delete**: keep the removed tasks returned by `deleteTask` and show a toast action that re-inserts them. This needs a `restoreTasks` domain function that re-checks permissions.
- **Virtualized columns and rows** for large lists (`@tanstack/react-virtual`). Keep `data-testid`s stable.
- **Custom dropdowns** to replace the native `<select>`s in the drawer with Headless UI `Listbox`, styled via `tokens.ts`.
