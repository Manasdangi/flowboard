import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SEED_IDS, statusId } from '@/data/seed';
import { renderApp } from './renderApp';

const { users: U, lists: L } = SEED_IDS;

const task = (store: ReturnType<typeof renderApp>['store'], id: string) => store.getState().data.tasks[id];

/** The point of in-place editing: none of it should open the task drawer. */
const noDrawer = () => {
  expect(screen.queryByTestId('task-drawer')).not.toBeInTheDocument();
  expect(window.location.search).not.toContain('task=');
};

describe('editing a task in the list view, without opening the drawer', () => {
  async function rowFor(title: string) {
    const app = renderApp({ route: { listId: L.backlog, view: 'list' } });
    await screen.findByTestId('task-table');
    // Looked up each time: changing a status can re-sort the table and move the row.
    return { ...app, row: () => within(screen.getByRole('row', { name: title })) };
  }

  it('renames a task from its row', async () => {
    const { user, store, row } = await rowFor('Dark mode exploration');
    await user.click(row().getByRole('button', { name: 'Edit title' }));
    const input = row().getByLabelText('Edit task title');
    await user.clear(input);
    await user.type(input, 'Dark mode spike{Enter}');
    expect(task(store, 't_bl_12').title).toBe('Dark mode spike');
    noDrawer();
  });

  it('Escape cancels a rename, and an empty title is refused', async () => {
    const { user, store, row } = await rowFor('Dark mode exploration');
    await user.click(row().getByRole('button', { name: 'Edit title' }));
    await user.type(row().getByLabelText('Edit task title'), ' extra{Escape}');
    expect(task(store, 't_bl_12').title).toBe('Dark mode exploration');

    await user.click(row().getByRole('button', { name: 'Edit title' }));
    await user.clear(row().getByLabelText('Edit task title'));
    await user.keyboard('{Enter}');
    expect(task(store, 't_bl_12').title).toBe('Dark mode exploration'); // "Title is required", nothing saved
    noDrawer();
  });

  it('changes priority, due date and status from the row', async () => {
    const { user, store, row } = await rowFor('Dark mode exploration');

    await user.click(row().getByRole('button', { name: /Change priority of/ }));
    await user.click(await screen.findByRole('menuitem', { name: 'Urgent' }));
    expect(task(store, 't_bl_12').priority).toBe('urgent');

    await user.click(row().getByRole('button', { name: /Change due date of/ }));
    fireEvent.change(await screen.findByLabelText('Due date'), { target: { value: '2026-12-24' } });
    expect(new Date(task(store, 't_bl_12').dueDate!).getDate()).toBe(24);
    await user.keyboard('{Enter}'); // closes the date popover

    // Last, because a Done task sorts to the end and leaves the first page of the table.
    await user.click(row().getByRole('button', { name: /Change status of/ }));
    await user.click(await screen.findByRole('menuitem', { name: 'Done' }));
    expect(task(store, 't_bl_12').statusId).toBe(statusId(L.backlog, 'done'));
    noDrawer();
  });

  it('assigns several people from the row', async () => {
    const { user, store, row } = await rowFor('Dark mode exploration');
    await user.click(row().getByRole('button', { name: 'Assign people' }));
    await user.click(await screen.findByRole('option', { name: /Bob Martinez/ }));
    await user.click(screen.getByRole('option', { name: /Carol Singh/ }));
    expect(task(store, 't_bl_12').assigneeIds).toEqual([U.bob, U.carol]);
    noDrawer();
  });

  it('clicking the row itself still opens the drawer', async () => {
    const { user } = await rowFor('Dark mode exploration');
    await user.click(screen.getByRole('row', { name: 'Dark mode exploration' }));
    expect(await screen.findByTestId('task-drawer')).toBeInTheDocument();
  });

  it('typing a space in the title editor does not open the drawer', async () => {
    const { user, row } = await rowFor('Dark mode exploration');
    await user.click(row().getByRole('button', { name: 'Edit title' }));
    await user.type(row().getByLabelText('Edit task title'), ' with spaces');
    noDrawer();
  });
});

describe('editing a task on the board, without opening the drawer', () => {
  async function cardFor(title: string) {
    const app = renderApp({ route: { listId: L.backlog } });
    await screen.findByTestId('board');
    return { ...app, card: screen.getByRole('button', { name: title }) };
  }

  it('renames a task from its card', async () => {
    const { user, store, card } = await cardFor('Dark mode exploration');
    await user.click(within(card).getByRole('button', { name: 'Edit title' }));
    const input = within(card).getByLabelText('Edit task title');
    await user.clear(input);
    await user.type(input, 'Dark mode spike{Enter}');
    expect(task(store, 't_bl_12').title).toBe('Dark mode spike');
    noDrawer();
  });

  it('changing status on a card moves it to that column', async () => {
    const { user, store, card } = await cardFor('Dark mode exploration');
    await user.click(within(card).getByRole('button', { name: /Change status of/ }));
    await user.click(await screen.findByRole('menuitem', { name: 'Done' }));
    expect(task(store, 't_bl_12').statusId).toBe(statusId(L.backlog, 'done'));
    expect(
      within(screen.getByTestId('column-Done')).getByRole('button', { name: 'Dark mode exploration' }),
    ).toBeVisible();
    noDrawer();
  });

  it('sets priority, due date and assignees from the card', async () => {
    const { user, store, card } = await cardFor('Dark mode exploration');

    await user.click(within(card).getByRole('button', { name: /Change priority of/ }));
    await user.click(await screen.findByRole('menuitem', { name: 'High' }));
    expect(task(store, 't_bl_12').priority).toBe('high');

    await user.click(within(card).getByRole('button', { name: /Change due date of/ }));
    fireEvent.change(await screen.findByLabelText('Due date'), { target: { value: '2026-11-05' } });
    expect(new Date(task(store, 't_bl_12').dueDate!).getMonth()).toBe(10);
    await user.keyboard('{Enter}'); // closes the date popover

    await user.click(within(card).getByRole('button', { name: 'Assign people' }));
    await user.click(await screen.findByRole('option', { name: /Alice Chen/ }));
    expect(task(store, 't_bl_12').assigneeIds).toEqual([U.alice]);
    noDrawer();
  });

  it('a member edits tasks they can see, and is only offered people with access', async () => {
    const { user, store } = renderApp({ userId: U.bob, route: { listId: L.sprint } });
    await screen.findByTestId('board');
    const card = screen.getByRole('button', { name: 'Task detail drawer with focus trap' });
    await user.click(within(card).getByRole('button', { name: /Assignees:/ }));
    const people = within(screen.getByRole('listbox'));
    expect(people.queryByRole('option', { name: /Carol Singh/ })).not.toBeInTheDocument(); // denied on Sprint 14
    await user.click(people.getByRole('option', { name: /Alice Chen/ }));
    expect(task(store, 't_sp_1').assigneeIds).toEqual([U.bob, U.alice]);
  });

  it('pressing Enter on a control inside a card opens its menu, not the drawer', async () => {
    const { user, card } = await cardFor('Dark mode exploration');
    within(card)
      .getByRole('button', { name: /Change priority of/ })
      .focus();
    await user.keyboard('{Enter}');
    expect(await screen.findByRole('menu')).toBeInTheDocument();
    noDrawer();
  });

  it('clicking the card body still opens the drawer', async () => {
    const { user, card } = await cardFor('Dark mode exploration');
    await user.click(card);
    expect(await screen.findByTestId('task-drawer')).toBeInTheDocument();
  });
});

describe('filters on the board', () => {
  it('filters cards by several assignees and by name, with honest counts', async () => {
    const { user } = renderApp({ route: { listId: L.backlog } });
    await screen.findByTestId('board');
    const cards = () => screen.getAllByTestId('task-card').map((c) => c.getAttribute('aria-label'));
    expect(cards()).toHaveLength(12);

    // Carol OR unassigned.
    await user.click(screen.getByRole('button', { name: 'Filter by assignee' }));
    await user.click(await screen.findByRole('option', { name: /Carol Singh/ }));
    await user.click(screen.getByRole('option', { name: /Unassigned/ }));
    await user.keyboard('{Escape}');
    expect(cards().sort()).toEqual(
      [
        'Add CSV export to list view',
        'Dark mode exploration',
        'Spike: realtime sync with CRDTs',
        'Write migration guide from spreadsheets',
      ].sort(),
    );
    expect(screen.getByText(/Showing/)).toHaveTextContent('Showing 4 of 12 tasks');
    expect(within(screen.getByTestId('column-To do')).getByText('3/6')).toBeInTheDocument();

    // The name narrows it further.
    await user.type(screen.getByLabelText('Filter tasks by name'), 'csv');
    expect(cards()).toEqual(['Add CSV export to list view']);
    expect(within(screen.getByTestId('column-Done')).getByText('No matching tasks')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(cards()).toHaveLength(12);
  });

  it('carries over between Board and List, and resets for another list', async () => {
    const { user } = renderApp({ route: { listId: L.backlog } });
    await screen.findByTestId('board');
    await user.type(screen.getByLabelText('Filter tasks by name'), 'csv');

    await user.click(screen.getByRole('tab', { name: 'List' }));
    const table = await screen.findByTestId('task-table');
    expect(within(table).getAllByTestId('task-row')).toHaveLength(1);
    expect(screen.getByLabelText('Filter tasks by name')).toHaveValue('csv');

    await user.click(within(screen.getByRole('tree', { name: 'Workspace' })).getByText('Sprint 14'));
    expect(await screen.findByLabelText('Filter tasks by name')).toHaveValue('');
  });
});
