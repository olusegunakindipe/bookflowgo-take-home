import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { makeTodo } from '../test/helpers';
import { TodoList } from './TodoList';

const ok = async () => ({ ok: true as const });
const handlers = { onToggle: ok, onUpdate: ok, onDelete: ok }; // stable, like the hook's useCallback handlers

describe('TodoList rendering', () => {
  it('re-renders only the card whose todo changed', () => {
    const todos = [1, 2, 3].map(() => makeTodo({ dueAt: '2026-12-01T09:00:00.000Z' }));
    const { rerender } = render(<TodoList todos={todos} {...handlers} />);

    // Each card formats its due date once per render, so counting calls counts card renders.
    const formatted = vi.spyOn(Date.prototype, 'toLocaleString');
    const next = [todos[0], { ...todos[1], completed: true }, todos[2]]; // same objects, except the changed one
    rerender(<TodoList todos={next} {...handlers} />);

    expect(formatted).toHaveBeenCalledTimes(1);
  });
});
