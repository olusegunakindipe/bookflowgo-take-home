import { useCallback, useEffect, useReducer } from 'react';
import * as api from '../api/todosApi';
import { ApiError, type FieldError, type Todo } from '../api/types';

export interface TodoDraft {
  title: string;
  description: string;
  dueAt: string | null;
}

export type MutationResult = { ok: true } | { ok: false; fieldErrors: FieldError[] };

export interface TodosState {
  items: Todo[];
  includeCompleted: boolean;
  status: 'loading' | 'ready' | 'error';
  loadError: string | null;
  actionError: string | null;
  reloadKey: number;
  /** Confirmed changes so far, and how many there were when the current list load started. */
  changeCount: number;
  loadStartedAtChange: number;
}

export type TodosAction =
  | { type: 'load_start' }
  | { type: 'load_success'; items: Todo[] }
  | { type: 'load_failure'; message: string }
  | { type: 'set_include_completed'; value: boolean }
  | { type: 'reload' }
  | { type: 'upsert'; todo: Todo }
  | { type: 'remove'; id: string }
  | { type: 'action_error'; message: string }
  | { type: 'dismiss_error' };

export const initialState: TodosState = {
  items: [],
  includeCompleted: false,
  status: 'loading',
  loadError: null,
  actionError: null,
  reloadKey: 0,
  changeCount: 0,
  loadStartedAtChange: 0,
};

export function todosReducer(state: TodosState, action: TodosAction): TodosState {
  switch (action.type) {
    case 'load_start':
      return { ...state, status: 'loading', loadError: null, loadStartedAtChange: state.changeCount };
    case 'load_success':
      // A change confirmed while this load was in flight is newer than the snapshot: keep it and reload.
      if (state.changeCount !== state.loadStartedAtChange) return { ...state, reloadKey: state.reloadKey + 1 };
      return { ...state, status: 'ready', items: action.items };
    case 'load_failure':
      return { ...state, status: 'error', loadError: action.message };
    case 'set_include_completed':
      return { ...state, includeCompleted: action.value };
    case 'reload':
      return { ...state, reloadKey: state.reloadKey + 1 };
    case 'upsert': {
      const others = state.items.filter((t) => t.id !== action.todo.id);
      const visible = state.includeCompleted || !action.todo.completed;
      const items = visible ? [...others, action.todo].sort((a, b) => a.ordinal - b.ordinal) : others;
      return { ...state, items, actionError: null, changeCount: state.changeCount + 1 };
    }
    case 'remove':
      return {
        ...state,
        items: state.items.filter((t) => t.id !== action.id),
        actionError: null,
        changeCount: state.changeCount + 1,
      };
    case 'action_error':
      return { ...state, actionError: action.message };
    case 'dismiss_error':
      return { ...state, actionError: null };
  }
}

const FALLBACK_MESSAGE = 'Something went wrong. Please try again.';

/** Owns all list state. Changes are applied only after the server confirms them (no optimistic updates). */
export function useTodos() {
  const [state, dispatch] = useReducer(todosReducer, initialState);

  useEffect(() => {
    let stale = false; // ignore responses for a superseded request (Review Focus #5)
    dispatch({ type: 'load_start' });
    api.listTodos(state.includeCompleted).then(
      (items) => !stale && dispatch({ type: 'load_success', items }),
      // A read failure must not say "your changes weren't saved", so only the network message is reused.
      (err) => !stale && dispatch({
        type: 'load_failure',
        message: err instanceof ApiError && err.kind === 'network' ? err.message : "Couldn't load your todos.",
      }),
    );
    return () => {
      stale = true;
    };
  }, [state.includeCompleted, state.reloadKey]);

  /** Field-level 400s go back to the form; every other failure shows the banner. A 404 also reloads. */
  const fail = useCallback((err: unknown): MutationResult => {
    if (err instanceof ApiError && err.kind === 'validation' && err.fieldErrors.length > 0) {
      return { ok: false, fieldErrors: err.fieldErrors };
    }
    dispatch({ type: 'action_error', message: err instanceof ApiError ? err.message : FALLBACK_MESSAGE });
    if (err instanceof ApiError && err.kind === 'not_found') dispatch({ type: 'reload' });
    return { ok: false, fieldErrors: [] };
  }, []);

  const saved = useCallback(async (request: Promise<Todo>): Promise<MutationResult> => {
    try {
      dispatch({ type: 'upsert', todo: await request });
      return { ok: true };
    } catch (err) {
      return fail(err);
    }
  }, [fail]);

  const createTodo = useCallback((draft: TodoDraft) => saved(api.createTodo(draft)), [saved]);
  const updateTodo = useCallback((id: string, draft: TodoDraft) => saved(api.updateTodo(id, draft)), [saved]);
  const toggleTodo = useCallback((todo: Todo) => saved(api.updateTodo(todo.id, { completed: !todo.completed })), [saved]);

  const deleteTodo = useCallback(async (id: string): Promise<MutationResult> => {
    try {
      await api.deleteTodo(id);
      dispatch({ type: 'remove', id });
      return { ok: true };
    } catch (err) {
      return fail(err);
    }
  }, [fail]);

  const setIncludeCompleted = useCallback((value: boolean) => dispatch({ type: 'set_include_completed', value }), []);
  const reload = useCallback(() => dispatch({ type: 'reload' }), []);
  const dismissError = useCallback(() => dispatch({ type: 'dismiss_error' }), []);

  return { ...state, createTodo, updateTodo, toggleTodo, deleteTodo, setIncludeCompleted, reload, dismissError };
}
