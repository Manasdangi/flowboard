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
  const card = column(page, 'To do').getByRole('button', { name: 'Task detail drawer with focus trap' });
  await drag(page, card, column(page, 'In review'));

  await expect(
    column(page, 'In review').getByRole('button', { name: 'Task detail drawer with focus trap' }),
  ).toBeVisible();
  await expect(column(page, 'To do').getByTestId('task-card')).toHaveCount(1);

  await page.waitForTimeout(800); // let the optimistic save settle + persistence debounce
  await page.reload();
  await expect(
    column(page, 'In review').getByRole('button', { name: 'Task detail drawer with focus trap' }),
  ).toBeVisible();
});

test('failed save rolls the card back with a toast', async ({ page }) => {
  await page.goto('/list/ls_security/board');
  await page.getByTestId('user-switcher').click();
  await page.getByRole('menuitem', { name: /Simulate save failures/ }).click();

  await drag(
    page,
    column(page, 'Open').getByRole('button', { name: 'Rotate staging API keys' }),
    column(page, 'Resolved'),
  );
  await expect(column(page, 'Resolved').getByRole('button', { name: 'Rotate staging API keys' })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('it was reverted');
  await expect(column(page, 'Open').getByRole('button', { name: 'Rotate staging API keys' })).toBeVisible();
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
