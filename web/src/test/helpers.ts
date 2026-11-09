import { vi } from 'vitest';
import type { Todo } from '../api/types';

export const json = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export function mockFetch() {
  const fn = vi.fn<typeof fetch>();
  vi.stubGlobal('fetch', fn);
  return fn;
}

let seq = 0;
export function makeTodo(overrides: Partial<Todo> = {}): Todo {
  seq += 1;
  return {
    id: `00000000-0000-4000-8000-${String(seq).padStart(12, '0')}`,
    title: `Todo ${seq}`,
    description: '',
    dueAt: null,
    ordinal: seq,
    completed: false,
    ...overrides,
  };
}
