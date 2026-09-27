# AI usage

**Tool:** Claude Code (Claude Opus) in VS Code, as an agentic pair programmer. It wrote code, ran the type-checker, linter and tests, and drove the running app in headless Chromium through Playwright to take screenshots. I set the direction, reviewed the output, and decided what to keep.

## How the work was split

- **What the AI did:** wrote most of the code, config, tests and docs, and tested the running app with Playwright.
- **What I did:** chose the stack, set the permission rules (nearest explicit rule wins, private is a barrier, container changes are admin-only), designed the Alice / Bob / Carol scenario, decided what to test, and reviewed every change against the brief.

## Key prompts

A selection of my prompts, grouped by purpose (typos fixed, wording otherwise mine).

### 1. Building features

| Prompt                                                                                                                                        | What it led to                                                       |
| --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| "In the assignee field we should be able to search and select from suggestions. The current UI won't work when there are a lot of assignees." | The searchable assignee picker.                                      |
| "I'm not able to filter by assignee so I can see only certain people's tasks. Give me a dropdown or filter to select one or two assignees."   | The assignee filter in the list view.                                |
| "Don't let a commit through when the code doesn't pass the lint check."                                                                       | The husky + lint-staged pre-commit hook.                             |
| "Here's the structure of a production repo I work on. Do we need any similar files here? Tell me first, then I'll say yes or no."             | Prettier, shared VS Code settings and recommended extensions.        |
| "This is a project made with AI and will get more features later, so create skill files, and any reference files we need."                    | `CLAUDE.md` and the `.claude/skills/` guides, including the roadmap. |
| "Implement path-based URLs for this project, with a rewrite rule. I'll deploy it on Vercel."                                                  | Clean URLs and the `vercel.json` rewrite.                            |

### 2. Reviewing and correcting

| Prompt                                                                                                                                                | What it led to                                                                           |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| "I've given you the PDF. Match the logic, the UI and the functionality against it, and tell me if you find any difference."                           | Found that members never saw the 403 on mutations (correction 2).                        |
| "Check everything against the PDF and tell me if I've done more than required or less than required."                                                 | A requirement-by-requirement audit, including the single-assignee mismatch.              |
| "Test it on your own, check every functionality and tell me any gap."                                                                                 | Hands-on testing that found the leftover "Untitled task" and the archive dialog wording. |
| "Marketing shows a lock icon, so as Bob I shouldn't be able to open it, but I can still see Brand Refresh and Launch Content. How is that happening?" | Hiding private parents entirely and adding "Shared with me" (correction 1).              |
| "Bob is able to open Security Audit, but the README says he doesn't have permission."                                                                 | Clearer README wording and a "Who can see what" table (correction 4).                    |
| "Why did you use hash routing? It looks weird. Is it the preferred way? Check how Jira and Linear do it."                                             | Switching to clean path URLs (correction 3).                                             |
| "Go back to Zustand. Remove all the Redux code you added."                                                                                            | Reverting the Redux migration.                                                           |

### 3. Understanding the code

I hadn't used Zustand before this project, and I'd only used basic Tailwind, so I asked the AI to explain the code until I could explain it myself:

| Prompt                                                                                                                                                         | Why I asked                                                    |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| "I've never used Zustand. Walk me through the store code: how you set up the context and provider, how actions are called, and how a component reads a value." | To understand the store well enough to defend it.              |
| "If we use Redux instead of Zustand, will it make things more complex?"                                                                                        | To make the Redux vs Zustand decision on real trade-offs.      |
| "I've only used basic Tailwind. Check if anything is written in a complex way that I couldn't understand in a day."                                            | To make sure the styling is readable, not just working.        |
| "What is Headless UI?" / "What is dnd-kit?" / "What is `.husky`?"                                                                                              | To understand each library and tool I was relying on.          |
| "What is v1 / v3 for storage?" / "What is the `dist` folder?"                                                                                                  | To understand persistence versioning and the production build. |

## Corrections: where the AI output was wrong or not good enough

1. **Private parents leaked through the tree.** Bob saw the private "Marketing" space as a greyed, locked row, which still revealed its name. The AI called this defensible and listed it as a known limitation; I pushed back, since the brief says the tree returns "only nodes the current user can see". Hidden parents are now left out entirely, shared items appear under **Shared with me**, and breadcrumbs skip hidden ancestors.
2. **The 403 on mutations was never visible.** Admin-only actions were disabled for members, so the brief's "attempting to mutate a denied resource shows a clear error" was only provable in a unit test. Members' clicks now reach the real store action, the guard refuses it, and a "Permission denied" toast appears.
3. **Hash routing, based on a wrong assumption.** URLs were first `/#/list/...`, on the idea that "no backend" meant "no server config". I questioned the `#` and asked how real products handle it. Clean paths only need the host to serve `index.html` for unknown paths, so we switched to `/list/<id>/<view>` with a `vercel.json` rewrite.
4. **Misleading README.** The demo steps made Bob's access to Security Audit look like a bug. The app was right; the docs were wrong. The README now explains what "private" means and has a "Who can see what" table.
5. **UX issues I caught by using the app:** an assignee field that wouldn't scale (now a searchable picker), misaligned dropdown arrows, a leftover empty "Untitled task" after closing a new task, broken wording in the archive dialog, and a confusing architecture diagram.

## What I rejected or chose differently

- **All-optimistic mutations.** Every mutation could have been made async. I kept only drag-and-drop optimistic (the stretch goal) and everything else synchronous, so the rollback path is small and testable, and the store is honest about being local.
- **A UI-only permission check.** Every guard lives in the domain layer, and a component test calls a store action directly as Bob to prove the store refuses on its own. Hiding or disabling a button is only a courtesy on top (see correction 2).
- **Leaking forbidden names.** The 403 screen, breadcrumbs, search and the tree never show a forbidden container's name (see correction 1).
- **Redux, after trying it.** I've always used Redux and asked for it instead of Zustand (the brief allows either). Partway through the migration I stopped it: the same domain functions were being wrapped in slices and thunks, adding boilerplate without adding any capability, because all the logic already lives outside the store. I had it fully reverted to Zustand.
- **One assignee, then back to many.** I first asked for a single assignee per task. When I had everything re-checked against the brief, it defines `assigneeIds` as an "Array of user IDs" and the views mention "assignees", so I reverted to multiple assignees.
- **Documenting a gap instead of fixing it.** For the private-parent names, the AI's suggestion was to keep the behaviour and list it as a known limitation. I chose to fix it (correction 1). Same for the missing workspace rename: it was described as minor, and I had it added.
