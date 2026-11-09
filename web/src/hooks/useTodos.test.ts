import { describe, expect, it } from 'vitest';
import type { Todo } from '../api/types';
import { initialState, todosReducer } from './useTodos';

const todo = (id: string, ordinal: number, completed = false): Todo =>
  ({ id, title: id, description: '', dueAt: null, ordinal, completed });

describe('todosReducer upsert', () => {
  it('inserts in ordinal order and clears any action error', () => {
    const state = { ...initialState, items: [todo('a', 1), todo('c', 3)], actionError: 'old' };
    const next = todosReducer(state, { type: 'upsert', todo: todo('b', 2) });
    expect(next.items.map((t) => t.id)).toEqual(['a', 'b', 'c']);
    expect(next.actionError).toBeNull();
  });

  it('removes a todo that became completed while completed items are hidden', () => {
    const state = { ...initialState, items: [todo('a', 1)] };
    expect(todosReducer(state, { type: 'upsert', todo: todo('a', 1, true) }).items).toEqual([]);
  });

  it('keeps a completed todo in place when completed items are shown', () => {
    const state = { ...initialState, includeCompleted: true, items: [todo('a', 1), todo('b', 2)] };
    const next = todosReducer(state, { type: 'upsert', todo: todo('a', 1, true) });
    expect(next.items.map((t) => [t.id, t.completed])).toEqual([['a', true], ['b', false]]);
  });
});

describe('todosReducer list loads vs. confirmed changes', () => {
  it('does not let a list load that started before a change overwrite it; it reloads instead', () => {
    let state = todosReducer({ ...initialState, items: [todo('a', 1)] }, { type: 'load_start' });
    state = todosReducer(state, { type: 'upsert', todo: { ...todo('a', 1), title: 'edited' } }); // PATCH lands first
    const next = todosReducer(state, { type: 'load_success', items: [todo('a', 1)] }); // older snapshot arrives

    expect(next.items[0].title).toBe('edited');
    expect(next.reloadKey).toBe(state.reloadKey + 1);
  });

  it('applies a list load normally when nothing changed while it was in flight', () => {
    const state = todosReducer(initialState, { type: 'load_start' });
    const next = todosReducer(state, { type: 'load_success', items: [todo('a', 1)] });
    expect(next.items).toEqual([todo('a', 1)]);
    expect(next.status).toBe('ready');
    expect(next.reloadKey).toBe(state.reloadKey);
  });
});
