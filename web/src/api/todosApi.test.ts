import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from './types';
import { MESSAGES, REQUEST_TIMEOUT_MS, createTodo, deleteTodo, listTodos } from './todosApi';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function mockFetch() {
  const fn = vi.fn<typeof fetch>();
  vi.stubGlobal('fetch', fn);
  return fn;
}

afterEach(() => vi.useRealTimers());

describe('todosApi', () => {
  it('lists with the includeCompleted query', async () => {
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValueOnce(json(200, []));
    await listTodos(true);
    expect(fetchMock).toHaveBeenCalledWith('/api/todos?includeCompleted=true', expect.any(Object));
  });

  it('sends JSON on create', async () => {
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValueOnce(json(201, { id: '1' }));
    await createTodo({ title: 'a', description: '', dueAt: null });
    expect(fetchMock).toHaveBeenCalledWith('/api/todos', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'a', description: '', dueAt: null }),
    }));
  });

  it('handles 204 on delete', async () => {
    mockFetch().mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(deleteTodo('1')).resolves.toBeUndefined();
  });

  it('maps a 400 VALIDATION_ERROR to field errors', async () => {
    const details = [{ field: 'title', message: 'Title is required' }];
    mockFetch().mockResolvedValueOnce(json(400, { error: { code: 'VALIDATION_ERROR', message: 'Invalid request', details } }));
    await expect(createTodo({ title: '' })).rejects.toMatchObject({ kind: 'validation', fieldErrors: details });
  });

  it.each([
    [404, 'not_found', MESSAGES.notFound],
    [500, 'server', MESSAGES.server],
    [503, 'server', MESSAGES.server],
  ])('maps HTTP %i to kind %s', async (status, kind, message) => {
    mockFetch().mockResolvedValueOnce(json(status, { error: { code: 'X', message: 'x' } }));
    await expect(listTodos(false)).rejects.toMatchObject({ kind, message, status });
  });

  it('never shows developer-facing server messages for other statuses', async () => {
    mockFetch().mockResolvedValueOnce(json(413, { error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body must be at most 10 KB' } }));
    await expect(createTodo({ title: 'a' })).rejects.toMatchObject({ kind: 'other', message: MESSAGES.unknown, status: 413 });
  });

  it('uses short, user-facing copy', () => {
    expect(MESSAGES).toEqual({
      network: "Can't reach the server. Please try again.",
      server: "Something went wrong. Your changes weren't saved.",
      notFound: 'This todo no longer exists. The list has been refreshed.',
      validation: 'Please fix the highlighted fields.',
      unknown: 'Something went wrong. Please try again.',
    });
  });

  // Our API always sends 5xx errors in its JSON format. A 5xx without it came from a proxy that
  // could not reach the API (Vite dev proxy: plain-text 500; reverse proxies: 502/503/504).
  it.each([
    ['Vite dev proxy', new Response('', { status: 500, headers: { 'Content-Type': 'text/plain' } })],
    ['reverse proxy', new Response('<html>Bad Gateway</html>', { status: 502, headers: { 'Content-Type': 'text/html' } })],
  ])('maps a 5xx without our error format (%s) to a network error', async (_source, response) => {
    mockFetch().mockResolvedValueOnce(response);
    await expect(listTodos(false)).rejects.toMatchObject({ kind: 'network', message: MESSAGES.network });
  });

  it('maps a 2xx with an unreadable body to an ApiError (every failure is an ApiError)', async () => {
    mockFetch().mockResolvedValueOnce(new Response('{not json', { status: 200 }));
    const err = await listTodos(false).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ kind: 'other', message: MESSAGES.unknown, status: 200 });
  });

  it('maps a thrown fetch (server down) to a network error', async () => {
    mockFetch().mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const err = await listTodos(false).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ kind: 'network', message: MESSAGES.network });
  });

  it('aborts after the timeout and reports a network error', async () => {
    vi.useFakeTimers();
    mockFetch().mockImplementationOnce((_url, init) =>
      new Promise((_resolve, reject) => {
        init!.signal!.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
      }),
    );
    const assertion = expect(listTodos(false)).rejects.toMatchObject({ kind: 'network' });
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);
    await assertion;
  });
});
