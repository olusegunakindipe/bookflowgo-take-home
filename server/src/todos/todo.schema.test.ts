import { describe, expect, it } from 'vitest';
import { createTodoSchema, idSchema, listQuerySchema, toFieldErrors, updateTodoSchema } from './todo.schema';

const fieldsOf = (result: ReturnType<typeof createTodoSchema.safeParse>) =>
  result.success ? [] : toFieldErrors(result.error);

describe('createTodoSchema', () => {
  it('accepts a minimal body and trims strings', () => {
    expect(createTodoSchema.parse({ title: '  Buy milk  ', description: '  2L  ' }))
      .toEqual({ title: 'Buy milk', description: '2L' });
  });

  it('requires a title, and treats whitespace-only as missing', () => {
    expect(fieldsOf(createTodoSchema.safeParse({}))).toEqual([{ field: 'title', message: 'Title is required' }]);
    expect(fieldsOf(createTodoSchema.safeParse({ title: '   ' }))).toEqual([{ field: 'title', message: 'Title is required' }]);
  });

  it('enforces 200 / 2000 character limits (after trimming)', () => {
    expect(createTodoSchema.safeParse({ title: 'x'.repeat(200) }).success).toBe(true);
    expect(createTodoSchema.safeParse({ title: ` ${'x'.repeat(200)} ` }).success).toBe(true);
    expect(fieldsOf(createTodoSchema.safeParse({ title: 'x'.repeat(201) }))[0].field).toBe('title');
    expect(createTodoSchema.safeParse({ title: 't', description: 'x'.repeat(2000) }).success).toBe(true);
    expect(fieldsOf(createTodoSchema.safeParse({ title: 't', description: 'x'.repeat(2001) }))[0].field).toBe('description');
  });

  it('accepts dueAt with Z or an offset, and null', () => {
    expect(createTodoSchema.safeParse({ title: 't', dueAt: '2026-12-01T09:30:00Z' }).success).toBe(true);
    expect(createTodoSchema.safeParse({ title: 't', dueAt: '2026-12-01T10:30:00.000+01:00' }).success).toBe(true);
    expect(createTodoSchema.safeParse({ title: 't', dueAt: null }).success).toBe(true);
  });

  it('rejects dueAt without an offset, garbage, or an impossible date', () => {
    for (const dueAt of ['2026-12-01T09:30:00', 'tomorrow', '2026-02-30T10:00:00Z', 12345]) {
      expect(fieldsOf(createTodoSchema.safeParse({ title: 't', dueAt }))).toEqual([
        { field: 'dueAt', message: 'Due date must be ISO 8601 with a timezone' },
      ]);
    }
  });

  it('rejects a dueAt whose UTC form leaves years 0000-9999 (it could not be sent back)', () => {
    expect(createTodoSchema.safeParse({ title: 't', dueAt: '9999-12-31T09:59:59-14:00' }).success).toBe(true);
    for (const dueAt of ['9999-12-31T23:59:59-14:00', '0000-01-01T00:00:00+01:00']) {
      expect(fieldsOf(createTodoSchema.safeParse({ title: 't', dueAt }))).toEqual([
        { field: 'dueAt', message: 'Due date is out of range' },
      ]);
    }
  });

  it('rejects unknown keys, including server-owned fields', () => {
    expect(fieldsOf(createTodoSchema.safeParse({ title: 't', ordinal: 1, id: 'x' })))
      .toEqual([{ field: 'ordinal', message: 'Unknown field' }, { field: 'id', message: 'Unknown field' }]);
  });

  it('rejects wrong types and non-object bodies', () => {
    expect(fieldsOf(createTodoSchema.safeParse({ title: 42 }))[0]).toEqual({ field: 'title', message: 'Title must be a string' });
    expect(fieldsOf(createTodoSchema.safeParse([]))[0].field).toBe('body');
  });
});

describe('updateTodoSchema', () => {
  it('accepts any single field', () => {
    expect(updateTodoSchema.parse({ completed: true })).toEqual({ completed: true });
    expect(updateTodoSchema.parse({ dueAt: null })).toEqual({ dueAt: null });
  });

  it('rejects an empty patch', () => {
    const r = updateTodoSchema.safeParse({});
    expect(r.success).toBe(false);
  });

  it('rejects a whitespace-only title (cannot blank a required field)', () => {
    expect(updateTodoSchema.safeParse({ title: '   ' }).success).toBe(false);
  });

  it('rejects a non-boolean completed', () => {
    expect(updateTodoSchema.safeParse({ completed: 'true' }).success).toBe(false);
  });
});

describe('listQuerySchema', () => {
  it('defaults includeCompleted to false and parses "true"/"false"', () => {
    expect(listQuerySchema.parse({})).toEqual({ includeCompleted: false });
    expect(listQuerySchema.parse({ includeCompleted: 'true' })).toEqual({ includeCompleted: true });
    expect(listQuerySchema.parse({ includeCompleted: 'false' })).toEqual({ includeCompleted: false });
  });

  it('rejects other values, including repeated params (arrays)', () => {
    expect(listQuerySchema.safeParse({ includeCompleted: 'yes' }).success).toBe(false);
    expect(listQuerySchema.safeParse({ includeCompleted: ['true', 'false'] }).success).toBe(false);
  });
});

describe('idSchema', () => {
  it('accepts UUIDs only', () => {
    expect(idSchema.safeParse('9b2f6f4e-6a3b-4c1f-9d55-0f6a2b8c1e7a').success).toBe(true);
    expect(idSchema.safeParse('123').success).toBe(false);
  });
});
