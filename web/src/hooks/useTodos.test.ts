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
