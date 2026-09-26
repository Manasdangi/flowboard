import { afterEach, describe, expect, it } from 'vitest';
import { buildPath, navigate } from './router';

const url = () => window.location.pathname + window.location.search;

describe('path router', () => {
  afterEach(() => window.history.replaceState(null, '', '/'));

  it('builds clean paths without a hash', () => {
    expect(buildPath({ listId: null, view: 'board', taskId: null })).toBe('/');
    expect(buildPath({ listId: 'ls_backlog', view: 'list', taskId: null })).toBe('/list/ls_backlog/list');
    expect(buildPath({ listId: 'ls_sprint', view: 'board', taskId: 't_sp_1' })).toBe(
      '/list/ls_sprint/board?task=t_sp_1',
    );
  });

  it('navigate merges a partial change into the current URL', () => {
    navigate({ listId: 'ls_backlog' });
    expect(url()).toBe('/list/ls_backlog/board');
    navigate({ taskId: 't_bl_6' });
    expect(url()).toBe('/list/ls_backlog/board?task=t_bl_6');
    navigate({ view: 'list', taskId: null });
    expect(url()).toBe('/list/ls_backlog/list');
    expect(window.location.hash).toBe('');
  });

  it('notifies subscribers (popstate) on navigate', () => {
    let fired = 0;
    const onPop = () => fired++;
    window.addEventListener('popstate', onPop);
    navigate({ listId: 'ls_sprint' });
    navigate({ listId: 'ls_sprint' }); // no-op: same URL
    window.removeEventListener('popstate', onPop);
    expect(fired).toBe(1);
  });
});
