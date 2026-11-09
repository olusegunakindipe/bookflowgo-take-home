import { describe, expect, it } from 'vitest';
import { mapServerErrors, toLocalInput, toUtcIso, validateTodoForm } from './todoForm';

const valid = { title: 'Buy milk', description: '', dueAt: '' };

describe('validateTodoForm', () => {
  it('accepts a valid form', () => {
    expect(validateTodoForm(valid)).toEqual({});
  });

  it('requires a non-blank title', () => {
    expect(validateTodoForm({ ...valid, title: '   ' })).toEqual({ title: 'Title is required' });
  });

  it('mirrors the server limits: title 200, description 2000 (after trimming)', () => {
    expect(validateTodoForm({ ...valid, title: 'x'.repeat(200) })).toEqual({});
    expect(validateTodoForm({ ...valid, title: 'x'.repeat(201) }).title).toBe('Title must be at most 200 characters');
    expect(validateTodoForm({ ...valid, description: ` ${'x'.repeat(2000)} ` })).toEqual({});
    expect(validateTodoForm({ ...valid, description: 'x'.repeat(2001) }).description).toBe('Description must be at most 2000 characters');
  });

  it('rejects an unparseable due date', () => {
    expect(validateTodoForm({ ...valid, dueAt: 'not-a-date' }).dueAt).toBe('Enter a valid due date');
  });
});

describe('date conversion', () => {
  it('returns null for an empty input', () => {
    expect(toUtcIso('')).toBeNull();
    expect(toLocalInput(null)).toBe('');
  });

  it('round-trips local input ↔ UTC ISO in any timezone', () => {
    const iso = '2026-12-01T09:30:00.000Z';
    expect(toUtcIso(toLocalInput(iso))).toBe(iso);
  });
});

describe('mapServerErrors', () => {
  it('maps known fields and puts anything else under form', () => {
    expect(mapServerErrors([
      { field: 'title', message: 'Title is required' },
      { field: 'ordinal', message: 'Unknown field' },
    ])).toEqual({ title: 'Title is required', form: 'Unknown field' });
  });
});
