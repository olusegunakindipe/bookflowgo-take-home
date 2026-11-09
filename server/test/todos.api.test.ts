import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Express } from 'express';
import { createApp } from '../src/app';
import { openDatabase, type Db } from '../src/db/database';
import { createSqliteTodoRepository, type TodoRepository } from '../src/todos/todo.repository';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const MISSING = '00000000-0000-4000-8000-000000000000';

let db: Db;
let app: Express;

beforeEach(() => {
  db = openDatabase(':memory:');
  app = createApp(createSqliteTodoRepository(db));
});
afterEach(() => db.close());

const create = (body: object) => request(app).post('/api/todos').send(body);

describe('POST /api/todos', () => {
  it('creates a todo with defaults and returns 201', async () => {
    const res = await create({ title: '  Buy milk ' });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ id: expect.stringMatching(UUID), title: 'Buy milk', description: '', dueAt: null, ordinal: 1, completed: false });
  });

  it('normalises dueAt to UTC', async () => {
    const res = await create({ title: 't', dueAt: '2026-12-01T10:30:00+01:00' });
    expect(res.body.dueAt).toBe('2026-12-01T09:30:00.000Z');
  });

  it('returns 400 VALIDATION_ERROR with field details', async () => {
    const res = await create({ title: '', ordinal: 5 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({ code: 'VALIDATION_ERROR', message: 'Invalid request' });
    // Order of issues is a Zod implementation detail, so assert membership, not order.
    expect(res.body.error.details).toHaveLength(2);
    expect(res.body.error.details).toEqual(expect.arrayContaining([
      { field: 'ordinal', message: 'Unknown field' },
      { field: 'title', message: 'Title is required' },
    ]));
  });

  it.each([['[]'], ['"text"'], ['null']])('rejects non-object JSON body %s with 400', async (raw) => {
    const res = await request(app).post('/api/todos').set('Content-Type', 'application/json').send(raw);
    expect(res.status).toBe(400);
    expect(['VALIDATION_ERROR', 'INVALID_JSON']).toContain(res.body.error.code);
  });

  it('returns 400 INVALID_JSON for malformed JSON', async () => {
    const res = await request(app).post('/api/todos').set('Content-Type', 'application/json').send('{"title":');
    expect(res.status).toBe(400);
    expect(res.body.error).toEqual({ code: 'INVALID_JSON', message: 'Request body must be a valid JSON object' });
  });

  it('returns 415 when the body is not JSON', async () => {
    const res = await request(app).post('/api/todos').set('Content-Type', 'text/plain').send('title=x');
    expect(res.status).toBe(415);
    expect(res.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
  });

  it('returns 413 when the body exceeds 10 KB', async () => {
    const res = await create({ title: 't', description: 'x'.repeat(11 * 1024) });
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });
});

describe('GET /api/todos', () => {
  it('lists by ordinal and hides completed by default', async () => {
    const a = (await create({ title: 'a' })).body;
    await create({ title: 'b' });
    await request(app).patch(`/api/todos/${a.id}`).send({ completed: true });

    const hidden = await request(app).get('/api/todos');
    expect(hidden.status).toBe(200);
    expect(hidden.body.map((t: { title: string }) => t.title)).toEqual(['b']);

    const all = await request(app).get('/api/todos?includeCompleted=true');
    expect(all.body.map((t: { title: string }) => t.title)).toEqual(['a', 'b']);
  });

  it.each(['yes', 'true&includeCompleted=false'])('returns 400 for includeCompleted=%s', async (value) => {
    const res = await request(app).get(`/api/todos?includeCompleted=${value}`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('PATCH /api/todos/:id', () => {
  it('edits fields and toggles completion both ways', async () => {
    const t = (await create({ title: 'a', dueAt: '2026-12-01T09:30:00Z' })).body;
    const edited = await request(app).patch(`/api/todos/${t.id}`).send({ title: 'b', description: 'd', dueAt: null });
    expect(edited.status).toBe(200);
    expect(edited.body).toMatchObject({ title: 'b', description: 'd', dueAt: null, ordinal: t.ordinal });

    expect((await request(app).patch(`/api/todos/${t.id}`).send({ completed: true })).body.completed).toBe(true);
    expect((await request(app).patch(`/api/todos/${t.id}`).send({ completed: false })).body.completed).toBe(false);
  });

  it('returns 400 for an empty patch, a blank title or an attempt to set ordinal', async () => {
    const t = (await create({ title: 'a' })).body;
    for (const body of [{}, { title: '  ' }, { ordinal: 1 }]) {
      const res = await request(app).patch(`/api/todos/${t.id}`).send(body);
      expect(res.status).toBe(400);
    }
  });

  it.each([MISSING, 'not-a-uuid'])('returns 404 NOT_FOUND for id %s', async (id) => {
    const res = await request(app).patch(`/api/todos/${id}`).send({ title: 'x' });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('DELETE /api/todos/:id', () => {
  it('deletes, removes it from the list, and then 404s', async () => {
    const t = (await create({ title: 'a' })).body;
    expect((await request(app).delete(`/api/todos/${t.id}`)).status).toBe(204);
    expect((await request(app).get('/api/todos?includeCompleted=true')).body).toEqual([]);
    expect((await request(app).delete(`/api/todos/${t.id}`)).status).toBe(404);
  });

  it('returns 404 for a malformed id', async () => {
    expect((await request(app).delete('/api/todos/not-a-uuid')).status).toBe(404);
  });
});

describe('cross-cutting behaviour', () => {
  it('returns 404 NOT_FOUND for unknown routes', async () => {
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('sends helmet security headers and hides X-Powered-By', async () => {
    const res = await request(app).get('/api/todos');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('returns a generic 500 without leaking internals', async () => {
    const boom = () => {
      throw new Error('disk on fire');
    };
    const failing: TodoRepository = { list: boom, create: boom, update: boom, delete: boom };
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await request(createApp(failing)).get('/api/todos');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
    expect(JSON.stringify(res.body)).not.toContain('disk on fire');
    expect(logged).toHaveBeenCalled();
    logged.mockRestore();
  });
});

describe('malformed client requests get 4xx, never 500', () => {
  it.each([
    ['an unsupported charset', 'application/json; charset=latin1', undefined, 415, 'UNSUPPORTED_MEDIA_TYPE'],
    ['an unsupported Content-Encoding', 'application/json', 'foo', 415, 'UNSUPPORTED_MEDIA_TYPE'],
    ['a body that is not valid gzip', 'application/json', 'gzip', 400, 'BAD_REQUEST'],
  ])('POST with %s', async (_case, type, encoding, status, code) => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const req = request(app).post('/api/todos').set('Content-Type', type);
    if (encoding) req.set('Content-Encoding', encoding);
    const res = await req.send('{"title":"x"}');
    expect(res.status).toBe(status);
    expect(res.body.error.code).toBe(code);
    expect(logged).not.toHaveBeenCalled();
  });

  it.each(['/api/todos/%', '/api/todos/%E0%A4%A'])('DELETE %s (malformed URL escape) gives 400', async (path) => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await request(app).delete(path);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: { code: 'BAD_REQUEST', message: 'Malformed request' } });
    expect(logged).not.toHaveBeenCalled();
  });
});
