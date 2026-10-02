import { act, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SEED_IDS } from '@/data/seed';
import { renderApp } from './renderApp';

const { users: U, lists: L } = SEED_IDS;

describe('tagging people in a comment', () => {
  it('suggests people as you type @, inserts the full name, and highlights the mention once posted', async () => {
    const { user, store } = renderApp({ route: { listId: L.backlog, taskId: 't_bl_1' } });
    const drawer = await screen.findByTestId('task-drawer');
    const box = within(drawer).getByLabelText('Add a comment');

    await user.type(box, 'Hi @ca');
    const suggestions = await screen.findByRole('listbox', { name: 'Mention suggestions' });
    expect(
      within(suggestions)
        .getAllByRole('option')
        .map((o) => o.getAttribute('aria-label')),
    ).toEqual(['Carol Singh']);

    await user.keyboard('{Enter}'); // picks the suggestion, doesn't post
    expect(box).toHaveValue('Hi @Carol Singh ');
    expect(screen.queryByRole('listbox', { name: 'Mention suggestions' })).not.toBeInTheDocument();

    await user.type(box, 'can you check this?');
    await user.click(within(drawer).getByRole('button', { name: 'Comment' }));

    const posted = Object.values(store.getState().data.comments).find((c) => c.body.startsWith('Hi @Carol'));
    expect(posted).toMatchObject({ authorId: U.alice, mentions: [U.carol], readBy: [] });
    const activity = within(drawer).getByRole('list', { name: 'Task activity' });
    expect(within(activity).getByText('@Carol Singh')).toHaveClass('font-medium'); // picked out of the sentence
  });

  it('lists everyone at a bare @, narrows as you type, and Escape closes only the suggestions', async () => {
    const { user } = renderApp({ route: { listId: L.backlog, taskId: 't_bl_1' } });
    const drawer = await screen.findByTestId('task-drawer');
    const box = within(drawer).getByLabelText('Add a comment');

    await user.type(box, '@');
    const names = () =>
      within(screen.getByRole('listbox', { name: 'Mention suggestions' }))
        .getAllByRole('option')
        .map((o) => o.getAttribute('aria-label'));
    expect(names()).toEqual(['Alice Chen', 'Bob Martinez', 'Carol Singh']);
    await user.type(box, 'bo');
    expect(names()).toEqual(['Bob Martinez']);

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox', { name: 'Mention suggestions' })).not.toBeInTheDocument();
    expect(screen.getByTestId('task-drawer')).toBeInTheDocument(); // the drawer stayed open
  });

  it('only suggests people who can see the task', async () => {
    const { user } = renderApp({ route: { listId: L.sprint, taskId: 't_sp_7' } });
    const drawer = await screen.findByTestId('task-drawer');
    await user.type(within(drawer).getByLabelText('Add a comment'), '@');
    const names = within(screen.getByRole('listbox', { name: 'Mention suggestions' }))
      .getAllByRole('option')
      .map((o) => o.getAttribute('aria-label'));
    expect(names).toEqual(['Alice Chen', 'Bob Martinez']); // Carol is denied on Sprint 14
  });

  it('does not suggest anything for an email address or a mid-word @', async () => {
    const { user } = renderApp({ route: { listId: L.backlog, taskId: 't_bl_1' } });
    const drawer = await screen.findByTestId('task-drawer');
    await user.type(within(drawer).getByLabelText('Add a comment'), 'write to bob@');
    expect(screen.queryByRole('listbox', { name: 'Mention suggestions' })).not.toBeInTheDocument();
  });
});

describe('the Mentions menu', () => {
  const badge = () => screen.getByTestId('mentions-button');

  it('shows each member their own unread count', async () => {
    const { store } = renderApp({ userId: U.bob, route: { listId: L.backlog } });
    await screen.findByTestId('board');
    expect(badge()).toHaveAccessibleName('Mentions, 2 unread');

    act(() => store.getState().actions.switchUser(U.carol));
    await waitFor(() => expect(badge()).toHaveAccessibleName('Mentions, 1 unread'));
    act(() => store.getState().actions.switchUser(U.alice));
    await waitFor(() => expect(badge()).toHaveAccessibleName('Mentions')); // Alice has read hers
  });

  it('lists who tagged you and where, newest first', async () => {
    const { user } = renderApp({ userId: U.bob, route: { listId: L.backlog } });
    await screen.findByTestId('board');
    await user.click(badge());

    const list = await screen.findByRole('list', { name: 'Your mentions' });
    const rows = within(list).getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('Alice Chen mentioned you in Engineering blog: how we built the kanban');
    expect(rows[0]).toHaveTextContent('Launch Content');
    expect(rows[1]).toHaveTextContent('Alice Chen mentioned you in Kanban drag-and-drop between columns');
    expect(rows[1]).toHaveTextContent('Sprint 14');
  });

  it('opens the task and marks just that mention read', async () => {
    const { user } = renderApp({ userId: U.bob, route: { listId: L.backlog } });
    await screen.findByTestId('board');
    await user.click(badge());
    const list = await screen.findByRole('list', { name: 'Your mentions' });
    await user.click(within(list).getAllByRole('button')[0]);

    expect(await screen.findByTestId('task-drawer')).toBeInTheDocument();
    expect(window.location.pathname).toContain(L.launch);
    expect(window.location.search).toContain('task=t_lc_1');
    expect(badge()).toHaveAccessibleName('Mentions, 1 unread');
  });

  it('marks everything read in one go', async () => {
    const { user } = renderApp({ userId: U.bob, route: { listId: L.backlog } });
    await screen.findByTestId('board');
    await user.click(badge());
    await user.click(await screen.findByRole('button', { name: 'Mark all as read' }));
    expect(badge()).toHaveAccessibleName('Mentions');
    expect(screen.getByRole('button', { name: 'Mark all as read' })).toBeDisabled();
  });

  it('shows a mention as soon as someone tags you', async () => {
    const { store } = renderApp({ userId: U.bob, route: { listId: L.backlog } });
    await screen.findByTestId('board');
    expect(badge()).toHaveAccessibleName('Mentions, 2 unread');

    act(() => {
      const { actions } = store.getState();
      actions.switchUser(U.alice);
      actions.addComment({ taskId: 't_bl_1', body: '@Bob Martinez the empty states are ready' });
      actions.switchUser(U.bob);
    });
    await waitFor(() => expect(badge()).toHaveAccessibleName('Mentions, 3 unread'));
  });

  it('never lists a mention on a task you can no longer open', async () => {
    const { user, store } = renderApp({ userId: U.bob, route: { listId: L.backlog } });
    await screen.findByTestId('board');
    act(() => {
      const { actions } = store.getState();
      actions.switchUser(U.alice);
      actions.setGrant({ resourceId: L.sprint, userId: U.bob, mode: 'deny' });
      actions.switchUser(U.bob);
    });
    await waitFor(() => expect(badge()).toHaveAccessibleName('Mentions, 1 unread'));
    await user.click(badge());
    const list = await screen.findByRole('list', { name: 'Your mentions' });
    expect(within(list).queryByText(/Kanban drag-and-drop/)).not.toBeInTheDocument();
    expect(within(list).queryByText(/Sprint 14/)).not.toBeInTheDocument();
  });
});
