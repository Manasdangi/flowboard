import { expect, test, type Locator, type Page } from '@playwright/test';

async function drag(page: Page, from: Locator, to: Locator) {
  const a = (await from.boundingBox())!;
  const b = (await to.boundingBox())!;
  const [x, y] = [a.x + Math.min(40, a.width / 2), a.y + Math.min(20, a.height / 2)];
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 10, y + 10, { steps: 5 }); // pass the 5px activation distance
  await page.mouse.move(b.x + b.width / 2, b.y + Math.max(b.height - 40, b.height / 2), { steps: 20 });
  await page.mouse.up();
}

const column = (page: Page, name: string) => page.getByTestId(`column-${name}`);
const tree = (page: Page) => page.getByRole('tree', { name: 'Workspace' });

test('kanban drag changes status and survives a reload', async ({ page }) => {
  await page.goto('/list/ls_sprint/board');
  const card = column(page, 'To do').getByRole('button', { name: 'Task detail drawer with focus trap', exact: true });
  await drag(page, card, column(page, 'In review'));

  await expect(
    column(page, 'In review').getByRole('button', { name: 'Task detail drawer with focus trap', exact: true }),
  ).toBeVisible();
  await expect(column(page, 'To do').getByTestId('task-card')).toHaveCount(1);

  await page.waitForTimeout(800); // let the optimistic save settle + persistence debounce
  await page.reload();
  await expect(
    column(page, 'In review').getByRole('button', { name: 'Task detail drawer with focus trap', exact: true }),
  ).toBeVisible();
});

test('failed save rolls the card back with a toast', async ({ page }) => {
  await page.goto('/list/ls_security/board');
  await page.getByTestId('user-switcher').click();
  await page.getByRole('menuitem', { name: /Simulate save failures/ }).click();

  await drag(
    page,
    column(page, 'Open').getByRole('button', { name: 'Rotate staging API keys', exact: true }),
    column(page, 'Resolved'),
  );
  await expect(
    column(page, 'Resolved').getByRole('button', { name: 'Rotate staging API keys', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('it was reverted');
  await expect(
    column(page, 'Open').getByRole('button', { name: 'Rotate staging API keys', exact: true }),
  ).toBeVisible();
});

test('Alice vs Bob: tree filtering and 403', async ({ page }) => {
  await page.goto('/list/ls_campaigns/board');
  await expect(tree(page).getByText('Campaigns')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Campaigns' })).toBeVisible();

  await page.getByTestId('user-switcher').click();
  await page.getByRole('menuitem', { name: /Bob Martinez/ }).click();

  await expect(page.getByText('403 · No access to this list')).toBeVisible();
  await expect(tree(page).getByText('Campaigns')).toHaveCount(0);
  await expect(tree(page).getByText('Security Audit')).toBeVisible();

  await page.getByRole('button', { name: 'Go to Backlog' }).click();
  await expect(page.getByRole('heading', { name: 'Backlog' })).toBeVisible();
});

test('reorders sidebar siblings by drag (admin)', async ({ page }) => {
  await page.goto('/list/ls_backlog/board');
  const order = async () => {
    const text = await tree(page).innerText();
    return ['Backlog', 'Sprint 14', 'Security Audit'].sort((a, b) => text.indexOf(a) - text.indexOf(b));
  };
  expect(await order()).toEqual(['Backlog', 'Sprint 14', 'Security Audit']);

  await tree(page)
    .getByRole('button', { name: /^Security Audit/ })
    .hover();
  await drag(
    page,
    page.getByRole('button', { name: 'Reorder Security Audit' }),
    tree(page).getByRole('button', { name: 'Backlog', exact: true }),
  );
  await expect.poll(order).toEqual(['Security Audit', 'Backlog', 'Sprint 14']);
});

test('assignee dropdown: Escape closes it first, then the drawer', async ({ page }) => {
  await page.goto('/list/ls_backlog/board?task=t_bl_6');
  const drawer = page.getByTestId('task-drawer');
  await drawer.getByRole('button', { name: /^Assignees:/ }).click();
  await expect(page.getByLabel('Search assignees')).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await expect(drawer).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(drawer).toHaveCount(0);
});

test('an uploaded image survives a reload (IndexedDB) and can be removed', async ({ page }) => {
  // A real 1x1 PNG.
  const pixel = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );
  await page.goto('/list/ls_backlog/board?task=t_bl_1');
  const drawer = page.getByTestId('task-drawer');
  await drawer
    .getByLabel('Add images or videos')
    .setInputFiles({ name: 'pixel.png', mimeType: 'image/png', buffer: pixel });

  const image = drawer.getByRole('img', { name: 'pixel.png' });
  await expect(image).toBeVisible();
  // The preview is a real decoded image read back from IndexedDB, not a placeholder.
  await expect(image).toHaveJSProperty('naturalWidth', 1);

  await page.waitForTimeout(800); // persistence debounce
  await page.reload();
  await expect(page.getByTestId('task-drawer').getByRole('img', { name: 'pixel.png' })).toBeVisible();

  await page.getByTestId('task-drawer').getByRole('button', { name: 'Remove pixel.png' }).click({ force: true });
  await expect(page.getByTestId('task-drawer').getByRole('img', { name: 'pixel.png' })).toHaveCount(0);
});

test('a finished sprint prints as a clean report without the app around it', async ({ page }) => {
  await page.goto('/list/ls_backlog/list');
  await page.getByRole('button', { name: 'Start sprint' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Start sprint' }).click();
  await page.getByRole('button', { name: 'End sprint' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'End sprint' }).click();
  const heading = page.getByRole('heading', { name: 'Sprint 1 · sprint report' });
  await expect(heading).toBeVisible();

  await page.emulateMedia({ media: 'print' });
  await expect(heading).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Sidebar' })).toBeHidden(); // the app shell is gone
  await expect(page.getByRole('button', { name: 'Print report' })).toBeHidden(); // so are the buttons
  // The report starts at the top of the page, not below a blank page left by the hidden app.
  expect((await heading.boundingBox())!.y).toBeLessThan(200);

  // Once the report is closed, printing the app itself works as before.
  await page.emulateMedia({ media: 'screen' });
  await page.getByRole('button', { name: 'Close' }).last().click();
  await page.emulateMedia({ media: 'print' });
  await expect(page.getByRole('complementary', { name: 'Sidebar' })).toBeVisible();
});

test('dragging on a filtered board lands the card correctly among the hidden ones', async ({ page }) => {
  await page.goto('/list/ls_backlog/board');
  // Bob only: the "In progress" column then hides "Write migration guide" (Carol's).
  await page.getByRole('button', { name: 'Filter by assignee' }).click();
  await page.getByRole('option', { name: /Bob Martinez/ }).click();
  await page.keyboard.press('Escape');
  await expect(column(page, 'In progress').getByTestId('task-card')).toHaveCount(2);

  await drag(
    page,
    column(page, 'To do').getByRole('button', { name: 'Design empty states for boards and lists', exact: true }),
    column(page, 'In progress'),
  );
  await page.waitForTimeout(800); // let the optimistic save settle

  await page.getByRole('button', { name: 'Clear filters' }).click();
  const titles = (name: string) =>
    column(page, name)
      .getByTestId('task-card')
      .evaluateAll((els) => els.map((el) => el.getAttribute('aria-label')));
  // The hidden card kept its place; the dropped one went to the end of the full column.
  expect(await titles('In progress')).toEqual([
    'Onboarding checklist for new workspaces',
    'Write migration guide from spreadsheets',
    'Reduce bundle size below 200 kB',
    'Design empty states for boards and lists',
  ]);
  expect(await titles('To do')).not.toContain('Design empty states for boards and lists');
});

test('tagging someone in a comment lands in their Mentions, and clicking it opens the task', async ({ page }) => {
  await page.goto('/list/ls_backlog/board?task=t_bl_2');
  const drawer = page.getByTestId('task-drawer');
  await drawer.getByLabel('Add a comment').click();
  await page.keyboard.type('Please check @bo');
  await page.keyboard.press('Enter'); // picks "Bob Martinez" from the suggestions
  await page.keyboard.type('before Friday');
  await drawer.getByRole('button', { name: 'Comment' }).click();
  await expect(drawer.getByRole('list', { name: 'Task activity' }).getByText('@Bob Martinez')).toBeVisible();

  await page.keyboard.press('Escape'); // close the drawer
  await expect(drawer).toHaveCount(0);
  await page.getByTestId('user-switcher').click();
  await page.getByRole('menuitem', { name: /Bob Martinez/ }).click();

  // Bob already had two seeded mentions; this is the third.
  const button = page.getByTestId('mentions-button');
  await expect(button).toHaveAccessibleName('Mentions, 3 unread');
  await button.click();
  await page
    .getByRole('list', { name: 'Your mentions' })
    .getByRole('button')
    .filter({ hasText: 'Keyboard navigation' })
    .click();
  await expect(page).toHaveURL(/task=t_bl_2/);
  await expect(page.getByTestId('task-drawer')).toBeVisible();
  await page.keyboard.press('Escape'); // the page behind an open drawer is inert, so look once it is closed
  await expect(page.getByTestId('task-drawer')).toHaveCount(0);
  await expect(button).toHaveAccessibleName('Mentions, 2 unread');
});
