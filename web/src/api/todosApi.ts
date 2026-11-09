import { ApiError, type CreateTodoInput, type FieldError, type Todo, type UpdateTodoInput } from './types';

export const REQUEST_TIMEOUT_MS = 10_000;

export const MESSAGES = {
  network: "Can't reach the server. Check it's running and try again.",
  server: "Something went wrong on the server. Your changes weren't saved. Please try again.",
  notFound: 'This todo no longer exists.',
  validation: 'Please fix the highlighted fields.',
  unknown: 'The request could not be completed. Please try again.',
} as const;

interface ErrorBody {
  error?: { code?: string; message?: string; details?: FieldError[] };
}

async function toApiError(response: Response): Promise<ApiError> {
  const body = (await response.json().catch(() => null)) as ErrorBody | null;
  const { status } = response;
  if (status === 400 && body?.error?.code === 'VALIDATION_ERROR') {
    return new ApiError('validation', MESSAGES.validation, status, body.error.details ?? []);
  }
  if (status === 404) return new ApiError('not_found', MESSAGES.notFound, status);
  if (status >= 500) return new ApiError('server', MESSAGES.server, status);
  return new ApiError('other', body?.error?.message ?? MESSAGES.unknown, status);
}

/** The only place that talks to the network. Every failure becomes an ApiError. */
async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(url, { ...init, signal: controller.signal });
  } catch {
    throw new ApiError('network', MESSAGES.network); // server down, offline, or timed out
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) throw await toApiError(response);
  return (response.status === 204 ? undefined : await response.json()) as T;
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
