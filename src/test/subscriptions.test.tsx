import { act, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SEED_IDS } from '@/data/seed';
import * as selectors from '@/domain/selectors';
import * as tree from '@/domain/tree';
import { renderApp } from './renderApp';

const { lists: L } = SEED_IDS;

/**
 * Components should subscribe to the slices they read, not the whole data set.
 * The sidebar's tree selector and the board selector only re-run when their own
 * inputs change, so we count their calls while changing unrelated data.
 */
describe('store subscriptions', () => {
  afterEach(() => vi.restoreAllMocks());

  async function setup() {
    const treeCalls = vi.spyOn(tree, 'selectVisibleTree');
    const boardCalls = vi.spyOn(selectors, 'selectBoard');
    const app = renderApp({ route: { listId: L.sprint } });
    await screen.findByTestId('board');
    return { ...app, tree: () => treeCalls.mock.calls.length, board: () => boardCalls.mock.calls.length };
  }

  it('a new comment or attachment does not rebuild the sidebar tree or the board', async () => {
    const app = await setup();
    const [tree0, board0] = [app.tree(), app.board()];

    act(() => void app.store.getState().actions.addComment({ taskId: 't_sp_1', body: 'hello' }));

    expect(app.tree()).toBe(tree0);
    expect(app.board()).toBe(board0);
  });

  it('editing a task rebuilds the board but not the sidebar tree', async () => {
    const app = await setup();
    const [tree0, board0] = [app.tree(), app.board()];

    act(() => void app.store.getState().actions.updateTask('t_sp_1', { priority: 'low' }));

    expect(app.board()).toBeGreaterThan(board0); // the card changed, so the board must update
    expect(app.tree()).toBe(tree0); // tasks don't affect which containers are visible
  });

  it('renaming a container rebuilds the sidebar tree', async () => {
    const app = await setup();
    const tree0 = app.tree();

    act(() => void app.store.getState().actions.renameContainer(L.backlog, 'Renamed'));

    expect(app.tree()).toBeGreaterThan(tree0);
  });
});
