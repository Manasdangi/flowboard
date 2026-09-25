# Flowboard: guide for AI assistants

Flowboard is a mini project-management app (ClickUp/Asana at hobby scale). It has no backend: a typed Zustand store, seeded from fixtures, stands in for the API and DB. The stack is React 18, TypeScript (strict), Vite 5, Tailwind 3, dnd-kit, Headless UI v2, Vitest + Testing Library, and Playwright.

`README.md` is written for human reviewers. This file is the working contract for code changes.

## Commands

| Command                     | Use                                                                                          |
| --------------------------- | -------------------------------------------------------------------------------------------- |
| `npm start` / `npm run dev` | Dev server on :5173                                                                          |
| `npm run typecheck`         | `tsc -b` (strict; unused locals are errors)                                                  |
| `npm run lint`              | ESLint                                                                                       |
| `npm test`                  | Vitest: domain, store and component tests                                                    |
| `npm run test:e2e`          | Playwright (builds, then serves on :4173). Run `npx playwright install chromium` once first. |
| `npm run check:dead`        | knip: unused files, exports and dependencies. Must be clean.                                 |
| `npm run format`            | Prettier (120 cols, single quotes, trailing commas; Tailwind classes auto-sorted)            |
| `npm run build`             | Type-check + production build                                                                |

**Pre-commit hook** (husky + lint-staged): `git commit` formats the staged files with Prettier, then runs ESLint with `--max-warnings=0` on the staged `.ts`/`.tsx` files and aborts on any problem. Fix the code; never bypass it with `--no-verify`. Don't hand-format or hand-sort Tailwind classes; Prettier owns formatting.

**Definition of done** for any change: `typecheck`, `lint`, `format:check`, `test` and `check:dead` all pass. If the UI changed, also run `test:e2e` and visually check the change (see the `flowboard-verify` skill).

## Architecture: where things go

```
src/domain/      Pure TS, no React/Zustand. Business rules live ONLY here.
  types.ts         DataState + entity types, Result<T>, StoreError
  permissions.ts   resolveAccess + guards (guardViewList, guardTask, guardManage)
  tree.ts          hierarchy rules (CHILD_TYPE), selectVisibleTree, ancestors
  selectors.ts     read models: selectBoard, selectListPage, selectTaskDetail, searchTasks
  tasks.ts / containers.ts / statuses.ts   mutations: (state, actorId, input, now) → Result<Change>
  ordering.ts      integer positions (step 1000), moveId + reindex
src/data/seed.ts   fixtures with STABLE ids (tests depend on them)
src/store/
  appStore.ts      Zustand store; actions wrap domain fns via commit(); moveTask is optimistic
  transport.ts     fake latency / failure injection
  persistence.ts   localStorage (key + SCHEMA_VERSION; bump the version when DataState changes shape)
  toasts.ts, ui.ts ephemeral UI state (toasts, search palette, dialogs)
  hooks.ts         useAppStore, useActions, useData, useCurrentUser, useIsAdmin
src/components/    React UI, grouped by area (board/, list/, task/, sidebar/, dialogs/, layout/, search/, ui/)
src/ui/tokens.ts   status / priority / avatar class maps (the single source of truth)
src/lib/           router (hash routes), dates, cn (clsx + tailwind-merge)
```

Data flow: component → `useActions().x()` → `commit(domainFn(get().data, actorId, input, now))`. On success it commits the new state; on `{ error }` it calls `onError`, which shows a toast. Reads: `useMemo(() => selectX(data, userId, …), [data, userId, …])`.

## Invariants (do not break)

1. **Permission checks live in `src/domain`, never only in the UI.** Every new selector or mutation must call a guard. Hiding a button is a courtesy on top.
2. **Every store call returns `Result<T>`**: `{ data }` or `{ error: { code, message } }`. Codes are `FORBIDDEN | NOT_FOUND | VALIDATION | CONFLICT | NETWORK`. Never throw for expected failures.
3. **Domain functions are pure.** They take `now` as an argument, don't mutate their input, and return a new `DataState`. Don't read `Date.now()` or `localStorage` in `src/domain`.
4. **Tailwind utilities only.** No CSS files, CSS modules, `@apply` or CSS-in-JS. No `style=` except dnd-kit transforms (currently exactly two: `TaskCard.tsx`, `SidebarTree.tsx`). Use theme tokens (`brand`, `ink`, `canvas`, `surface`, `line`, `shadow-card`, `rounded-card`, …) rather than raw hex. Status and priority colours come from `src/ui/tokens.ts` only.
5. **Never leak forbidden data.** A 403 must not reveal a list's name, tasks, or breadcrumbs. Search and assignee suggestions are permission-filtered.
6. **Hierarchy**: workspace → space → folder → list. Lists hold tasks only. Subtasks are one level deep.
7. **One assignee per task.** `assigneeIds` is an array of length ≤ `MAX_ASSIGNEES` (1), enforced in `tasks.ts`.
8. **Seed ids are a test contract.** Add new fixtures; don't rename existing ids.

## Conventions

- Match the surrounding style: short doc comments that explain _why_, no commented-out code, named exports.
- Only export what another module imports (`check:dead` enforces this).
- Put new store state in `AppState` only if it must survive navigation. Transient UI state goes in `store/ui.ts` or component state.
- Tests: domain rules → `src/domain/*.test.ts`; store behaviour → `src/store/appStore.test.ts`; user flows → `src/test/App.test.tsx` (via `renderApp`); real drag-and-drop or a real browser → `e2e/`.
- Keep `README.md` in sync when behaviour or trade-offs change. `AI_USAGE.md` is the author's own log; don't write in it unless asked.

## Skills in this repo

- `flowboard-feature`: step-by-step recipe for adding a feature, plus `reference/roadmap.md` with designs for the next planned features.
- `flowboard-permissions`: how access resolves and how to extend the model (teams, permission levels).
- `flowboard-ui`: design tokens, the component catalogue, and interaction/accessibility rules.
- `flowboard-verify`: launch the app and check a change with Playwright screenshots.
