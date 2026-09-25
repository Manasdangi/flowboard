---
name: flowboard-verify
description: Launch Flowboard and verify a change in a real browser with Playwright screenshots, covering the demo flows (Alice vs Bob, drag-and-drop, rollback, drawer). Use after any UI change, when asked to run, check or screenshot the app, or when a bug is only visible visually (layout, class conflicts, a blank page).
---

# Verifying Flowboard in a browser

Type-checks and jsdom tests can't catch layout bugs. This project has already hit a collapsed input caused by a class conflict, a white-on-white icon, and a blank page from files that were only partly reverted. **Look at the screen.**

## 1. Make sure the dev server is up

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5173/   # 200 = running
# otherwise start it in the background:
npm run dev
```

Playwright's Chromium needs to be installed once: `npx playwright install chromium`.

## 2. Screenshot script

Write the script to a temporary `.shot.mjs` **in the repo root**, so it can resolve `@playwright/test`. Save images to a scratch directory, not the repo. Delete the script afterwards.

```js
import { chromium } from '@playwright/test';
const OUT = process.argv[2];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', (e) => console.log('pageerror:', e.message)); // blank page? look here first
page.on('console', (m) => m.type() === 'error' && console.log('console:', m.text()));
await page.goto('http://localhost:5173/#/list/ls_sprint/board');
await page.waitForTimeout(1500); // simulated latency + skeleton
await page.screenshot({ path: `${OUT}/board.png` });
await browser.close();
```

Run it with `node .shot.mjs <out-dir> && rm .shot.mjs`, then read the PNGs.

Each browser context starts with empty `localStorage`, so screenshots always show the seed data.

## 3. Useful routes and seed ids

| What              | URL / id                                                                                                                                       |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Board / list view | `#/list/<listId>/board`, `#/list/<listId>/list`                                                                                                |
| Open the drawer   | append `?task=<taskId>`, e.g. `#/list/ls_backlog/board?task=t_bl_6`                                                                            |
| Lists             | `ls_backlog`, `ls_sprint` (Carol denied), `ls_security` (private, Bob allowed), `ls_campaigns` (Marketing, private), `ls_launch` (Bob allowed) |
| 403 demo          | switch to Bob, then open `#/list/ls_campaigns/board`                                                                                           |

## 4. Common interactions

```js
// switch user
await page.getByTestId('user-switcher').click();
await page.getByRole('menuitem', { name: /Bob Martinez/ }).click();

// drag a card (dnd-kit needs a 5px move before it activates)
const from = await page.getByTestId('task-card').filter({ hasText: 'Task detail drawer' }).boundingBox();
const to = await page.getByTestId('column-Done').boundingBox();
await page.mouse.move(from.x + 40, from.y + 20);
await page.mouse.down();
await page.mouse.move(from.x + 50, from.y + 30, { steps: 5 });
await page.mouse.move(to.x + to.width / 2, to.y + 120, { steps: 20 });
await page.mouse.up();

// rollback demo
await page.getByTestId('user-switcher').click();
await page.getByRole('menuitem', { name: /Simulate save failures/ }).click();

// hover-only controls (tree row actions) must be hovered before they're clickable
await page.getByRole('button', { name: /^Q2 Launch$/ }).hover();
await page.getByRole('button', { name: 'Q2 Launch options' }).click();

// search palette
await page.keyboard.press('Meta+k');
await page.keyboard.type('launch');
```

Use `page.screenshot({ clip: { x, y, width, height } })` to zoom into a region, e.g. the drawer at `x: 896, width: 544`.

## 5. What to check in the screenshot

- There's no `pageerror`, and `#root` has children.
- Tokens render (brand accent, borders); nothing is collapsed, clipped or overflowing at 1440×900.
- Every state is present: skeleton → content, empty, 403, hover and focus.
- Permission differences are visible (compare Alice with Bob).
- Then run the real suites: `npm test` and `npm run test:e2e`.
