import { ApiError, type CreateTodoInput, type FieldError, type Todo, type UpdateTodoInput } from './types';

export const REQUEST_TIMEOUT_MS = 10_000;

// All user-facing banner copy lives here; server messages never appear in a banner. (A server
// field-level validation message may be shown inline next to the matching form input.)
export const MESSAGES = {
  network: "Can't reach the server. Please try again.",
  server: "Something went wrong. Your changes weren't saved.",
  notFound: 'This todo no longer exists. The list has been refreshed.',
  validation: 'Please fix the highlighted fields.',
  unknown: 'Something went wrong. Please try again.',
} as const;

interface ErrorBody {
  error?: { code?: string; details?: FieldError[] };
}

async function toApiError(response: Response): Promise<ApiError> {
  const body = (await response.json().catch(() => null)) as ErrorBody | null;
  const { status } = response;
  if (status === 400 && body?.error?.code === 'VALIDATION_ERROR') {
    return new ApiError('validation', MESSAGES.validation, status, body.error.details ?? []);
  }
  if (status === 404) return new ApiError('not_found', MESSAGES.notFound, status);
  if (status >= 500) {
    // Our API always sends 5xx errors in its JSON format; without it, a proxy (Vite in dev,
    // a reverse proxy in production) answered because the API itself could not be reached.
    return body?.error?.code
      ? new ApiError('server', MESSAGES.server, status)
      : new ApiError('network', MESSAGES.network, status);
  }
  return new ApiError('other', MESSAGES.unknown, status);
}

/**
 * The only place that talks to the network. Every failure becomes an ApiError, and the timeout
 * covers the whole exchange (headers and body).
 */
async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    let response: Response;
    try {
      response = await fetch(url, { ...init, signal: controller.signal });
    } catch {
      throw new ApiError('network', MESSAGES.network); // server down, offline, or timed out
    }
    if (!response.ok) throw await toApiError(response);
    if (response.status === 204) return undefined as T;
    try {
      return (await response.json()) as T;
    } catch {
      throw controller.signal.aborted
        ? new ApiError('network', MESSAGES.network) // timed out while reading the body
        : new ApiError('other', MESSAGES.unknown, response.status); // 2xx with an unreadable body
    }
  } finally {
    clearTimeout(timer);
  }
}

const withJson = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

const itemUrl = (id: string) => `/api/todos/${encodeURIComponent(id)}`;

export const listTodos = (includeCompleted: boolean) =>
  request<Todo[]>(`/api/todos?includeCompleted=${includeCompleted}`, { method: 'GET' });

export const createTodo = (input: CreateTodoInput) => request<Todo>('/api/todos', withJson('POST', input));

export const updateTodo = (id: string, changes: UpdateTodoInput) =>
  request<Todo>(itemUrl(id), withJson('PATCH', changes));

export const deleteTodo = (id: string) => request<void>(itemUrl(id), { method: 'DELETE' });
