import { randomUUID } from 'node:crypto';
import type { Db } from '../db/database';

export interface Todo {
  id: string;
  title: string;
  description: string;
  dueAt: string | null;
  ordinal: number;
  completed: boolean;
}

export interface NewTodo {
  title: string;
  description: string;
  dueAt: string | null;
}

export type TodoChanges = Partial<Pick<Todo, 'title' | 'description' | 'dueAt' | 'completed'>>;

/** Persistence port: the service depends on this, not on SQLite. */
export interface TodoRepository {
  list(opts: { includeCompleted: boolean }): Todo[];
  findById(id: string): Todo | undefined;
  create(input: NewTodo): Todo;
  update(id: string, changes: TodoChanges): Todo | undefined;
  delete(id: string): boolean;
}

interface TodoRow {
  id: string;
  title: string;
  description: string;
  due_at: string | null;
  ordinal: number;
  completed: 0 | 1;
}

/** Explicit mapper: responses never expose raw rows. */
function toTodo(row: TodoRow): Todo {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    dueAt: row.due_at,
    ordinal: row.ordinal,
    completed: row.completed === 1,
  };
}

export function createSqliteTodoRepository(db: Db): TodoRepository {
  const listOpen = db.prepare('SELECT * FROM todos WHERE completed = 0 ORDER BY ordinal');
  const listAll = db.prepare('SELECT * FROM todos ORDER BY ordinal');
  const byId = db.prepare('SELECT * FROM todos WHERE id = ?');
  // Every write below is a single statement, which SQLite runs atomically, so no explicit
  // transactions are needed. The ordinal (max + 1) is computed inside the INSERT itself.
  const insert = db.prepare(`
    INSERT INTO todos (id, title, description, due_at, ordinal, completed)
    VALUES (@id, @title, @description, @dueAt, (SELECT COALESCE(MAX(ordinal), 0) + 1 FROM todos), 0)
    RETURNING *`);
  const update = db.prepare(`
    UPDATE todos SET
      title       = COALESCE(@title, title),
      description = COALESCE(@description, description),
      due_at      = CASE WHEN @setDueAt = 1 THEN @dueAt ELSE due_at END,
      completed   = COALESCE(@completed, completed)
    WHERE id = @id
    RETURNING *`);
  const remove = db.prepare('DELETE FROM todos WHERE id = ?');

  return {
    list: ({ includeCompleted }) =>
      ((includeCompleted ? listAll : listOpen).all() as TodoRow[]).map(toTodo),
    findById: (id) => {
      const row = byId.get(id) as TodoRow | undefined;
      return row && toTodo(row);
    },
    create: (input) => toTodo(insert.get({ id: randomUUID(), ...input }) as TodoRow),
    update: (id, changes) => {
      const row = update.get({
        id,
        title: changes.title ?? null,
        description: changes.description ?? null,
        setDueAt: changes.dueAt === undefined ? 0 : 1,
        dueAt: changes.dueAt ?? null,
        completed: changes.completed === undefined ? null : changes.completed ? 1 : 0,
      }) as TodoRow | undefined;
      return row && toTodo(row);
    },
    delete: (id) => remove.run(id).changes > 0,
  };
}
