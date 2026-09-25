import { act, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SEED_IDS } from '@/data/seed';
import { renderApp } from './renderApp';

const { users: U, lists: L } = SEED_IDS;
const tree = () => screen.getByRole('tree', { name: 'Workspace' });

describe('App — permissions in the UI', () => {
  it('switching from Alice to Bob immediately changes the sidebar tree', async () => {
    const { user } = renderApp({ route: { listId: L.backlog } });
    expect(await within(tree()).findByText('Campaigns')).toBeInTheDocument();
    expect(within(tree()).getByText('Security Audit')).toBeInTheDocument();

    await user.click(screen.getByTestId('user-switcher'));
    await user.click(await screen.findByRole('menuitem', { name: /Bob Martinez/ }));

    await waitFor(() => expect(within(tree()).queryByText('Campaigns')).not.toBeInTheDocument());
    expect(within(tree()).getByText('Security Audit')).toBeInTheDocument();
    expect(within(tree()).getByText('Launch Content')).toBeInTheDocument();
    expect(screen.getByText(/Member view/)).toBeInTheDocument();
  });

  it('shows a 403 screen when a member opens a list they cannot access', async () => {
    renderApp({ userId: U.bob, route: { listId: L.campaigns } });
    expect(await screen.findByText(/403 · No access to this list/)).toBeInTheDocument();
    // No task names or breadcrumbs from the forbidden list leak into the page.
    expect(screen.queryByText('Product Hunt launch post')).not.toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeEmptyDOMElement();
  });

  it('the board becomes forbidden the moment the viewer switches to a user without access', async () => {
    const { store } = renderApp({ route: { listId: L.campaigns } });
    expect(await screen.findByTestId('board')).toBeInTheDocument();
    act(() => store.getState().actions.switchUser(U.bob));
    expect(await screen.findByText(/403 · No access/)).toBeInTheDocument();
  });

  it('member mutation attempts surface a permission toast', async () => {
    const { store } = renderApp({ userId: U.bob, route: { listId: L.backlog } });
    await screen.findByTestId('board');
    act(() => void store.getState().actions.renameContainer(L.backlog, 'Mine now'));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Only workspace admins can rename/);
  });
});

describe('App — board, list and drawer', () => {
  it('renders kanban columns from the list’s own status set', async () => {
    renderApp({ route: { listId: L.sprint } });
    const board = await screen.findByTestId('board');
    const headings = within(board)
      .getAllByRole('heading', { level: 3 })
      .map((h) => h.textContent);
    expect(headings).toEqual(['To do', 'In progress', 'In review', 'Done']);
    expect(within(screen.getByTestId('column-In review')).getAllByTestId('task-card')).toHaveLength(1);
  });

  it('opens the task drawer from a card, edits the title, and closes on Escape', async () => {
    const { user, store } = renderApp({ route: { listId: L.sprint } });
    await user.click(await screen.findByRole('button', { name: 'Kanban drag-and-drop between columns' }));

    const drawer = await screen.findByTestId('task-drawer');
    const title = within(drawer).getByLabelText('Task title');
    expect(title).toHaveFocus();
    await user.clear(title);
    await user.type(title, 'Kanban DnD polish{Enter}');
    expect(store.getState().data.tasks.t_sp_3.title).toBe('Kanban DnD polish');

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByTestId('task-drawer')).not.toBeInTheDocument());
    expect(window.location.hash).not.toContain('task=');
  });

  it('changing status in the drawer moves the card to that column', async () => {
    const { user } = renderApp({ route: { listId: L.sprint, taskId: 't_sp_1' } });
    const drawer = await screen.findByTestId('task-drawer');
    await user.selectOptions(within(drawer).getByLabelText('Status'), 'In review');
    await user.keyboard('{Escape}');
    await waitFor(() =>
      expect(
        within(screen.getByTestId('column-In review'))
          .getAllByTestId('task-card')
          .map((c) => c.textContent),
      ).toEqual(expect.arrayContaining([expect.stringContaining('Task detail drawer with focus trap')])),
    );
  });

  it('assignee field searches people with access; picking replaces the single assignee', async () => {
    const { user, store } = renderApp({ route: { listId: L.backlog, taskId: 't_bl_1' } });
    const drawer = await screen.findByTestId('task-drawer');
    const search = within(drawer).getByLabelText('Search assignee');
    expect(within(drawer).getByTestId('assignee-chip')).toHaveTextContent('Bob Martinez');

    await user.type(search, 'car');
    const options = await screen.findAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual([expect.stringContaining('Carol Singh')]);
    await user.click(options[0]);
    // Carol replaces Bob — a task has exactly one owner.
    expect(store.getState().data.tasks.t_bl_1.assigneeIds).toEqual([U.carol]);
    expect(within(drawer).getByTestId('assignee-chip')).toHaveTextContent('Carol Singh');
    expect(search).toHaveValue('');

    await user.click(within(drawer).getByRole('button', { name: 'Unassign Carol Singh' }));
    expect(store.getState().data.tasks.t_bl_1.assigneeIds).toEqual([]);
    expect(within(drawer).queryByTestId('assignee-chip')).not.toBeInTheDocument();

    // Backspace on an empty query unassigns.
    await user.type(search, 'ali');
    await user.click(await screen.findByRole('option', { name: /Alice Chen/ }));
    await user.click(search);
    await user.keyboard('{Backspace}');
    expect(store.getState().data.tasks.t_bl_1.assigneeIds).toEqual([]);
  });

  it('assignee suggestions only include people who can see the list', async () => {
    const { user } = renderApp({ route: { listId: L.sprint, taskId: 't_sp_7' } });
    const drawer = await screen.findByTestId('task-drawer');
    await user.type(within(drawer).getByLabelText('Search assignee'), 'carol');
    // Carol is denied on Sprint 14, so she is never offered.
    expect(await screen.findByText(/No one with access to this list matches/)).toBeInTheDocument();
    expect(screen.queryByRole('option')).not.toBeInTheDocument();
  });

  it('list view sorts by due date and paginates', async () => {
    const { user } = renderApp({ route: { listId: L.backlog, view: 'list' } });
    const table = await screen.findByTestId('task-table');
    expect(within(table).getAllByTestId('task-row')).toHaveLength(10);
    expect(screen.getByText(/of/).textContent).toContain('12');

    await user.click(within(table).getByRole('button', { name: /Due date/ }));
    const rows = within(table)
      .getAllByTestId('task-row')
      .map((r) => r.getAttribute('aria-label'));
    // Most overdue first; tasks without a due date sink to the bottom.
    expect(rows[0]).toBe('Set up Vite + Tailwind scaffold');

    await user.click(screen.getByRole('button', { name: /Load 2 more/ }));
    expect(within(table).getAllByTestId('task-row')).toHaveLength(12);
  });

  it('quick-adds a task into a column', async () => {
    const { user } = renderApp({ route: { listId: L.security } });
    const column = await screen.findByTestId('column-Resolved');
    await user.click(within(column).getByRole('button', { name: 'Add task' }));
    await user.type(within(column).getByLabelText('New task title'), 'Pen-test report{Enter}');
    expect(within(column).getByRole('button', { name: 'Pen-test report' })).toBeInTheDocument();
  });
});
