---
name: flowboard-feature
description: Recipe for adding or changing a Flowboard feature end to end (domain → store → UI → tests → docs). Use when implementing anything new in this repo, such as an activity feed, bulk update, keyboard shortcuts, new task fields, new container actions, or new views, or when extending an existing flow.
---

# Adding a feature to Flowboard

Work **inside-out**: domain rules first, then the store, then the UI. Each layer is tested at its own level. Read `CLAUDE.md` first for the invariants.

Before designing, check `reference/roadmap.md`. The planned next features already have agreed designs there.

## 1. Model (only if data changes): `src/domain/types.ts`

- Add fields to the entity types or `DataState`. Keep `DataState` normalized (`Record<ID, Entity>`) and serializable (no Dates, Maps or functions).
- Update `src/data/seed.ts` so the feature is demoable. Add new ids; never rename existing ones.
- **Bump `SCHEMA_VERSION` (and the key) in `src/store/persistence.ts`**, otherwise old `localStorage` blobs will load with the wrong shape.

## 2. Rules: `src/domain/*.ts`

A mutation looks like this:

```ts
export function doThing(data: DataState, actorId: ID, input: DoThingInput, now: ISODate): Result<Change<Thing>> {
  const denied = guardViewList(data, actorId, input.listId); // or guardTask / guardManage
  if (denied) return { error: denied };
  // validate → fail('VALIDATION', '…') / fail('CONFLICT', '…')
  // build the next state immutably
  return ok({ state: { ...data, tasks: { ...data.tasks, [id]: next } }, value: next });
}
```

A read model is a selector `(data, userId, …) → Result<Model>` in `selectors.ts` that starts with a guard. Anything that lists items across lists must filter with `selectVisibleLists` or `canViewContainer`.

Rules for this layer:

- The guard comes first, always. Pick it by resource: task → `guardTask`; list contents → `guardViewList`; structure, sharing or statuses → `guardManage` (admin only).
- Messages are human sentences; they're shown directly in toasts.
- Ordering: use `moveId` + `reindex` from `ordering.ts`. Don't invent fractional positions.
- No side effects: no `Date.now()`, no randomness except via `newId`, no I/O.

## 3. Store: `src/store/appStore.ts`

- Add the signature to `AppActions` and implement it as a one-liner through `commit(...)`:
  ```ts
  doThing: (input) => commit(things.doThing(get().data, actor(), input, now())),
  ```
  `commit` already routes errors to `onError` (a toast). Don't add toast calls in components for failures.
- If the action is async or optimistic, copy the `moveTask` pattern: snapshot → commit → `simulateSave` → roll back only the records this call touched, and only if they're unchanged since.
- Transient UI state (open panels, selection) goes in `store/ui.ts` or component state, not `AppState`.

## 4. UI: `src/components/…`

- Read with `useAppStore` / `useData` plus a memoized selector. Write with `useActions()`.
- Handle every state the brief expects: **loading** (skeletons in `ui/Skeleton.tsx`), **empty** (`ui/EmptyState`), **error / 403**, and **hover / focus / active**.
- Styling follows the `flowboard-ui` skill (tokens only, no `style=`).
- Deep-linkable state goes in the URL path/query (`lib/router.ts`).

## 5. Tests (all required)

| Layer   | File                                                            | What to assert                                                       |
| ------- | --------------------------------------------------------------- | -------------------------------------------------------------------- |
| Domain  | `src/domain/<area>.test.ts` or `permissions.test.ts`            | Rules, validation messages, and 403 for members without access       |
| Store   | `src/store/appStore.test.ts` (`setup(userId, settings)` helper) | The action commits or rejects and leaves state untouched on error    |
| UI flow | `src/test/App.test.tsx` (`renderApp({ userId, route })`)        | The user-visible flow through roles and labels                       |
| Browser | `e2e/flowboard.spec.ts`                                         | Only for real DnD, reload persistence, or layout-dependent behaviour |

Always include at least one test where a **member without access** tries the feature and gets `FORBIDDEN`.

## 6. Finish

1. `npm run typecheck && npm run lint && npm test && npm run check:dead`
2. If the UI changed: `npm run test:e2e`, then do a visual check with the `flowboard-verify` skill.
3. Update `README.md` (feature list, data model, trade-offs, and the stretch goals attempted if it's one of them).

## Common mistakes seen in this repo

- A conflicting class override that doesn't apply: `cn()` uses tailwind-merge, so always pass overrides through `cn(base, className)`. Register new custom tokens in `src/lib/cn.ts` (for example, a new `text-*` size would otherwise be mistaken for a colour).
- Inventing Tailwind classes (`ring-dashed` doesn't exist; use `outline-dashed`).
- Measuring DOM in JS to set a size (`el.style.height = …`). Use a CSS-only technique instead (see the title mirror grid in `TaskDrawer.tsx`).
- Forgetting that selectors run per render: keep them pure and memoize on `(data, userId, …)`.
