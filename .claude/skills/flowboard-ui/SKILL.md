---
name: flowboard-ui
description: Flowboard's UI rules. It covers the Tailwind-only styling constraints, design tokens, the shared component catalogue, and the interaction/accessibility bar (loading, empty, error, focus, DnD). Use when building or restyling any component, choosing colours or spacing, adding a dialog, menu, drawer or picker, or touching drag-and-drop.
---

# Flowboard UI conventions

## Hard rules (from the assignment brief; reviewers check these)

- **Tailwind utility classes in JSX only.** No new `.css` files, CSS modules, `@apply` or CSS-in-JS. `src/index.css` contains just the three `@tailwind` directives.
- **No `style=`**, with one documented exception: the dnd-kit `transform`/`transition` on sortable nodes (`TaskCard.tsx`, `SidebarTree.tsx`). If you add another sortable, add it to the README's "DnD style= exceptions" table. Don't set `el.style` from JS either.
- UI libraries must be headless or Tailwind-friendly. We use **Headless UI v2** (Dialog, Menu, Combobox) and **lucide-react** icons.
- Desktop-first (the app shell has `min-w-[960px]`). Dark mode is out of scope.

Check with: `grep -rn "style=" src --include=*.tsx`. The result must be exactly the two dnd-kit lines.

## Tokens (`tailwind.config.ts`)

| Group        | Names                                                                                                                   | Use                                                 |
| ------------ | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| colors       | `brand-50…900`                                                                                                          | Primary actions, selection, focus, drop targets     |
|              | `ink` / `ink-muted` / `ink-subtle` / `ink-faint`                                                                        | Text, from primary down to disabled/placeholder     |
|              | `canvas`, `surface`, `surface-muted`, `surface-sunken`                                                                  | App background → cards/panels → hover/pressed wells |
|              | `line`, `line-strong`                                                                                                   | Borders, dividers, input rings                      |
| fontSize     | `text-2xs`                                                                                                              | Metadata, badges, counts                            |
| borderRadius | `rounded-control` (inputs/buttons), `rounded-card` (cards/toasts), `rounded-panel` (columns/dialogs)                    |                                                     |
| boxShadow    | `shadow-card`, `shadow-card-hover`, `shadow-drag`, `shadow-pop` (menus/dialogs/toasts), `shadow-drawer`, `shadow-focus` |                                                     |
| animation    | `animate-fade-in`, `animate-pop-in`, `animate-slide-in-right`, `animate-toast-in`                                       | Entrances only                                      |

**Semantic colours come from `src/ui/tokens.ts`, never inline:**

- `STATUS_STYLES[status.color]` gives `dot`, `pill` and `text`.
- `PRIORITY_STYLES[priority]` gives `label`, `badge` and `icon`.
- `AVATAR_STYLES[user.avatarColor]`.
- `FOCUS_RING` goes on every custom interactive element.

A status or priority must look identical on the card, row, drawer and search result, so always go through these maps. Tailwind's JIT needs full class strings, so never build class names by concatenation (for example `` `bg-${c}-500` `` won't work).

**Adding a token**: add it to `tailwind.config.ts`, then register it in `src/lib/cn.ts` (`extendTailwindMerge`) if tailwind-merge could misclassify it. For example, a custom `text-*` size would otherwise be treated as a colour and silently drop `text-ink`.

## Component catalogue (`src/components/ui/`); reuse before creating

| Component                                                                   | Notes                                                                                                                                                                                                                    |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Button`                                                                    | `variant`: primary / secondary / ghost / danger; `size`: sm / md                                                                                                                                                         |
| `IconButton`                                                                | `label` is required (it becomes the aria-label and title); 28×28                                                                                                                                                         |
| `Avatar`, `AvatarStack`                                                     | Initials + `AVATAR_STYLES`; the stack shows +N past `max`                                                                                                                                                                |
| `StatusIcon`, `StatusPill`, `PriorityBadge`, `DueDate`                      | In `Badges.tsx`. `DueDate` tones: overdue, today, soon, later, done                                                                                                                                                      |
| `TextInput`, `TextArea`, `Select`, `FieldLabel`                             | In `Field.tsx`; the shared control ring and focus style                                                                                                                                                                  |
| `Menu`, `MenuButton`, `MenuPanel`, `MenuAction`, `MenuDivider`, `MenuLabel` | In `Menu.tsx`. `MenuAction` supports `muted` + `hint`. Members get muted-but-clickable "Admins only" items that call the real store action, so the 403 surfaces as a toast. Don't hide a denied action behind `disabled` |
| `Modal`                                                                     | Centred dialog: title, description, footer. Escape and overlay close; focus is trapped and restored                                                                                                                      |
| `EmptyState`                                                                | `icon`, `title`, children, `action`, `tone="danger"` for 403 screens                                                                                                                                                     |
| `Skeleton`, `TreeSkeleton`, `BoardSkeleton`, `ListSkeleton`                 | Use while `boot === 'loading'` or `loadingListId === listId`                                                                                                                                                             |
| `Toaster` + `notify.*`                                                      | Don't call `notify.error` for store failures; `commit` already does it                                                                                                                                                   |
| `Kbd`                                                                       | Keyboard hint chip                                                                                                                                                                                                       |

Feature components worth copying from: `task/AssigneePicker.tsx` (a Combobox with permission-scoped suggestions), `dialogs/ShareDialog.tsx` (segmented controls), `board/BoardView.tsx` (multi-container DnD), and `sidebar/SidebarTree.tsx` (sibling-only sortable tree).

## Interaction bar (every new surface)

| Area     | Requirement                                                                                                                                                           |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Loading  | Skeleton on first load or list switch; no layout jump when data arrives                                                                                               |
| Empty    | `EmptyState` or an inline hint that says what to do next                                                                                                              |
| Errors   | Store errors toast automatically. Forbidden resources render a 403 `EmptyState` without leaking names                                                                 |
| Feedback | Hover, `focus-visible` (via `FOCUS_RING`) and active states on every clickable element                                                                                |
| Overlays | Use Headless UI `Dialog`: Escape and overlay-click close it; set initial focus with `data-autofocus` or `autoFocus`                                                   |
| DnD      | `PointerSensor` with `activationConstraint: { distance: 5 }` so clicks still open things; `DragOverlay` preview; highlight the target; persist through a store action |
| Keyboard | Enter opens; Space starts a keyboard drag on the board (Enter is reserved for opening)                                                                                |
| A11y     | Real `button`s, `aria-label` on icon-only controls, `role` + `aria-selected` / `aria-checked` on custom tabs and radios                                               |

## Testing hooks

Keep the existing `data-testid`s stable: `board`, `column-<Status name>`, `task-card`, `task-row`, `task-table`, `task-drawer`, `user-switcher`, `assignee-chip`. Prefer role- or label-based queries in new tests.
