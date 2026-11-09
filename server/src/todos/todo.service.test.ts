import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDatabase, type Db } from '../db/database';
import { NotFoundError } from '../http/errors';
import { createSqliteTodoRepository } from './todo.repository';
import { TodoService, toUtcIso } from './todo.service';

const MISSING = '00000000-0000-4000-8000-000000000000';

describe('toUtcIso', () => {
  it('normalises any offset to UTC and passes null through', () => {
    expect(toUtcIso('2026-12-01T10:30:00+01:00')).toBe('2026-12-01T09:30:00.000Z');
    expect(toUtcIso(null)).toBeNull();
  });
});

// Uses a real :memory: repository rather than a mock: the service's rules are checked through the
// results a user would see. A test double is used only where a failure must be injected (API 500 test).
describe('TodoService', () => {
  let db: Db;
  let service: TodoService;
  beforeEach(() => {
    db = openDatabase(':memory:');
    service = new TodoService(createSqliteTodoRepository(db));
  });
  afterEach(() => db.close());

  it('applies defaults on create', () => {
    expect(service.create({ title: 'a' })).toMatchObject({ description: '', dueAt: null, completed: false, ordinal: 1 });
  });

  it('stores dueAt in UTC on create and update', () => {
    const t = service.create({ title: 'a', dueAt: '2026-12-01T10:30:00+01:00' });
    expect(t.dueAt).toBe('2026-12-01T09:30:00.000Z');
    expect(service.update(t.id, { dueAt: '2026-12-02T00:00:00-05:00' }).dueAt).toBe('2026-12-02T05:00:00.000Z');
  });

  it('toggles completion both ways', () => {
    const t = service.create({ title: 'a' });
    expect(service.update(t.id, { completed: true }).completed).toBe(true);
    expect(service.update(t.id, { completed: false }).completed).toBe(false);
  });

  it('throws NotFoundError for unknown ids', () => {
    expect(() => service.update(MISSING, { title: 'x' })).toThrow(NotFoundError);
    expect(() => service.delete(MISSING)).toThrow(NotFoundError);
  });
});
