# Flowboard: guide for AI assistants

Mini project-management app with no backend: a typed Zustand store seeded from fixtures stands in for the API and DB. React 18, TypeScript (strict), Vite 5, Tailwind 3, dnd-kit, Headless UI v2, Vitest, Playwright.

## Commands

| Command              | Use                                                                    |
| -------------------- | ---------------------------------------------------------------------- |
| `npm run dev`        | Dev server on :5173                                                    |
| `npm run typecheck`  | `tsc -b` (strict)                                                      |
| `npm run lint`       | ESLint                                                                 |
| `npm test`           | Vitest: domain, store and component tests                              |
| `npm run test:e2e`   | Playwright on :4173. Run `npx playwright install chromium` once first. |
| `npm run check:dead` | knip: unused files, exports and dependencies. Must be clean.           |
| `npm run format`     | Prettier (Tailwind classes auto-sorted)                                |

**Definition of done:** `typecheck`, `lint`, `format:check`, `test` and `check:dead` pass. If the UI changed, also run `test:e2e` and check it visually (`flowboard-verify` skill). The pre-commit hook runs Prettier and ESLint (`--max-warnings=0`); never bypass it with `--no-verify`.

## Where things go

```
src/domain/      Pure TS, no React/Zustand. All business rules and permission checks live here.
src/data/seed.ts Fixtures with stable ids (tests depend on them)
src/store/       Zustand store: actions wrap domain functions via commit(); ui.ts holds transient UI state
src/components/  React UI, grouped by area
src/ui/tokens.ts Status / priority / avatar colours (single source of truth)
src/lib/         Router (History API), dates, cn()
```

Data flow: component → `useActions().x()` → `commit(domainFn(data, actorId, input, now))`. Success commits the new state; `{ error }` shows a toast.

## Rules (do not break)

1. **Permission checks live in `src/domain`, never only in the UI.** Every new selector or mutation calls a guard.
2. **Every store call returns `Result<T>`**: `{ data }` or `{ error: { code, message } }`, with codes `FORBIDDEN | NOT_FOUND | VALIDATION | CONFLICT | NETWORK`. Don't throw for expected failures.
3. **Tailwind utilities only.** No CSS files, `@apply` or CSS-in-JS. No `style=` except the two dnd-kit transforms (`TaskCard.tsx`, `SidebarTree.tsx`). Use theme tokens, not raw hex.
4. **Never leak forbidden data.** A 403 must not reveal a list's name, tasks or breadcrumbs. Search and assignee suggestions are permission-filtered.
5. **Hierarchy:** workspace → space → folder → list. Lists hold tasks only. Subtasks are one level deep.
6. **Seed ids are a test contract.** Add fixtures; don't rename existing ids.
7. **Bump `SCHEMA_VERSION`** in `persistence.ts` when `DataState` changes shape.

## Conventions

- Match the surrounding style. Named exports; only export what's imported elsewhere.
- Tests: domain rules → `src/domain/*.test.ts`, store → `src/store/appStore.test.ts`, user flows → `src/test/App.test.tsx`, real drag-and-drop → `e2e/`.
- Keep `README.md` in sync with behaviour changes. Don't edit `AI_USAGE.md` unless asked.

## Skills

`flowboard-feature` (adding a feature, plus the roadmap), `flowboard-permissions` (extending the access model), `flowboard-ui` (tokens and components), `flowboard-verify` (checking a change in the browser).
