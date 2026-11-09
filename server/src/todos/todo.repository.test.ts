import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDatabase, type Db } from '../db/database';
import { createSqliteTodoRepository, type TodoRepository } from './todo.repository';

const draft = (title: string) => ({ title, description: '', dueAt: null });

describe('SqliteTodoRepository', () => {
  let db: Db;
  let repo: TodoRepository;

  beforeEach(() => {
    db = openDatabase(':memory:');
    repo = createSqliteTodoRepository(db);
  });
  afterEach(() => db.close());

  it('creates a todo with a UUID, ordinal 1 and completed false', () => {
    const todo = repo.create({ title: 'First', description: 'd', dueAt: '2026-12-01T09:30:00.000Z' });
    expect(todo).toEqual({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      title: 'First',
      description: 'd',
      dueAt: '2026-12-01T09:30:00.000Z',
      ordinal: 1,
      completed: false,
    });
  });

  it('assigns max(ordinal) + 1, not count + 1, after a delete', () => {
    repo.create(draft('a'));
    const b = repo.create(draft('b'));
    repo.create(draft('c'));
    repo.delete(b.id);
    expect(repo.create(draft('d')).ordinal).toBe(4);
  });

  it('lists by ordinal and hides completed unless asked', () => {
    const a = repo.create(draft('a'));
    const b = repo.create(draft('b'));
    repo.update(a.id, { completed: true });
    expect(repo.list({ includeCompleted: false }).map((t) => t.title)).toEqual(['b']);
    expect(repo.list({ includeCompleted: true }).map((t) => t.id)).toEqual([a.id, b.id]);
  });

  it('updates only the provided fields', () => {
    const t = repo.create({ title: 'a', description: 'keep', dueAt: '2026-12-01T09:30:00.000Z' });
    const updated = repo.update(t.id, { title: 'b' });
    expect(updated).toMatchObject({ title: 'b', description: 'keep', dueAt: '2026-12-01T09:30:00.000Z', completed: false });
  });

  it('clears dueAt when null is provided', () => {
    const t = repo.create({ title: 'a', description: '', dueAt: '2026-12-01T09:30:00.000Z' });
    expect(repo.update(t.id, { dueAt: null })?.dueAt).toBeNull();
  });

  it('returns undefined / false for unknown ids', () => {
    const missing = '00000000-0000-4000-8000-000000000000';
    expect(repo.findById(missing)).toBeUndefined();
    expect(repo.update(missing, { title: 'x' })).toBeUndefined();
    expect(repo.delete(missing)).toBe(false);
  });

  it('deletes an existing todo', () => {
    const t = repo.create(draft('a'));
    expect(repo.delete(t.id)).toBe(true);
    expect(repo.findById(t.id)).toBeUndefined();
  });
});
