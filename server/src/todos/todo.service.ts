import { NotFoundError } from '../http/errors';
import type { Todo, TodoChanges, TodoRepository } from './todo.repository';
import type { CreateTodoInput, UpdateTodoInput } from './todo.schema';

/** Accepts a validated ISO date-time with an offset and returns it in canonical UTC form. */
export function toUtcIso(value: string | null): string | null {
  return value === null ? null : new Date(value).toISOString();
}

/** Domain rules: defaults, UTC normalisation, not-found. Depends only on the TodoRepository port. */
export class TodoService {
  constructor(private readonly repo: TodoRepository) {}

  list(includeCompleted: boolean): Todo[] {
    return this.repo.list({ includeCompleted });
  }

  create(input: CreateTodoInput): Todo {
    return this.repo.create({
      title: input.title,
      description: input.description ?? '',
      dueAt: toUtcIso(input.dueAt ?? null),
    });
  }

  update(id: string, input: UpdateTodoInput): Todo {
    const changes: TodoChanges = { ...input };
    if (input.dueAt !== undefined) changes.dueAt = toUtcIso(input.dueAt);
    const todo = this.repo.update(id, changes);
    if (!todo) throw new NotFoundError();
    return todo;
  }

  delete(id: string): void {
    if (!this.repo.delete(id)) throw new NotFoundError();
  }
}
