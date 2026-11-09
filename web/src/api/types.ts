// Mirrors the server contract (spec §2–3). Kept by hand on purpose (validation approach A).
export interface Todo {
  id: string;
  title: string;
  description: string;
  dueAt: string | null;
  ordinal: number;
  completed: boolean;
}

export interface CreateTodoInput {
  title: string;
  description?: string;
  dueAt?: string | null;
}

export type UpdateTodoInput = Partial<{
  title: string;
  description: string;
  dueAt: string | null;
  completed: boolean;
}>;

export interface FieldError {
  field: string;
  message: string;
}

export type ApiErrorKind = 'validation' | 'not_found' | 'server' | 'network' | 'other';

export class ApiError extends Error {
  constructor(
    readonly kind: ApiErrorKind,
    message: string,
    readonly status?: number,
    readonly fieldErrors: FieldError[] = [],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
