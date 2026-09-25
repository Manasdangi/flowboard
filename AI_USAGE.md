# AI usage

**Tool:** Claude Code (Claude Opus) in VS Code, as an agentic pair programmer. It wrote code, ran the type-checker, linter and tests, and drove the running app in headless Chromium through Playwright to take screenshots. I set the direction, reviewed the output, and decided what to keep.

## How the work was split

| Phase        | What the AI did                                                                                                       | What I did                                                                                                                                     |
| ------------ | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Scaffold     | Wrote the Vite, TS, Tailwind, ESLint and Vitest config by hand after `npm create vite` hung on an interactive prompt. | Chose the stack: React + Zustand + dnd-kit + Headless UI.                                                                                      |
| Domain layer | Drafted `permissions.ts`, `tree.ts`, `tasks.ts`, `containers.ts`, `statuses.ts` and `selectors.ts` as pure functions. | Set the rules: nearest explicit rule wins; private is a barrier; container CRUD is admin-only; archive containers but hard-delete tasks.       |
| Seed data    | Generated fixtures.                                                                                                   | Designed the permission scenario so the Alice / Bob / Carol differences are visible in under 30 seconds, including one "restricted path" case. |
| UI           | Generated components against the token set.                                                                           | Reviewed screenshots of every state (loading, empty, 403, drag, rollback, dialogs) and asked for fixes.                                        |
| Tests        | Drafted unit, store, component and E2E tests.                                                                         | Picked what to cover: permission filtering, 403s on mutations, rollback, and real drag in a browser.                                           |

## Corrections: where the AI output was wrong or not good enough

1. **Class-merging bug found visually.** `cn()` was plain `clsx`, so `<Select className="w-36">` still had the base `w-full`, and `w-full` won. The status editor's name field collapsed to a few pixels. Type-checking and tests couldn't catch this; only the screenshot did. The fix was `tailwind-merge`. That alone wasn't enough, though: `tailwind-merge` would have treated the custom `text-2xs` as a text _colour_ and silently dropped `text-ink`. I configured it with the custom font-size, shadow and radius tokens.
2. **Broke the no-inline-style rule.** The first version of the auto-growing task title set `el.style.height = scrollHeight` in an effect. That is inline styling for layout, which the brief forbids. I replaced it with a pure-Tailwind approach: an invisible mirror `<div>` and the `<textarea>` share one grid cell, so the grid sizes to the text.
3. **Invented a utility.** It used `ring-dashed`, which doesn't exist in Tailwind. The drag placeholder is now `outline-dashed outline-2`.
4. **Permission explanation threw away information.** `resolveAccess` originally collapsed any inherited decision into `reason: 'inherited'`, so the Sharing dialog couldn't say whether the inherited rule was an allow, a deny or privacy. I changed it to keep the original reason plus `decidedBy`, so the UI can say "Denied on 'Q2 Launch'".
5. **Restricted tree nodes looked accessible.** A styling rule for spaces (`text-ink`) overrode the greyed style on restricted path-only nodes, so Bob's "Marketing" looked like a normal space. I fixed the class order and made restricted rows non-interactive.
6. **Flaky E2E helper.** The drag helper grabbed 40 px into the element, but the tree's grip handle is 14 px wide, so the sidebar-reorder test "failed" without any app bug. The helper now grabs from the element's center.
7. **Dependency conflict.** The first install pulled `@eslint/js@10` against `eslint@9`, and I pinned it. `npm create vite` also blocked on a prompt in a non-interactive shell, so the config was written by hand.
8. **Small review fixes:** leftover dead exports, an unused variable pattern that ESLint would reject, an un-awaited `expect(...).resolves`, and empty metadata rows on cards that have no priority, date or assignee.

## What I rejected or chose differently

- **All-optimistic mutations.** Every mutation could have been made async. I kept only drag-and-drop optimistic (the stretch goal) and everything else synchronous, so the rollback path is small and testable, and the store is honest about being local.
- **A UI-only permission check.** Early on it was tempting to just hide buttons. Every guard lives in the domain layer instead, and a component test calls a store action directly as Bob to prove the store refuses on its own.
- **Leaking forbidden names.** The 403 screen and breadcrumbs deliberately don't show the forbidden list's name.
- **Keyboard-sensor defaults.** dnd-kit starts a keyboard drag on Enter by default, which conflicts with "Enter opens the task". The kanban now starts a keyboard drag with Space only.
