import { Router } from 'express';
import type { z } from 'zod';
import { NotFoundError, ValidationError } from '../http/errors';
import { createTodoSchema, idSchema, listQuerySchema, toFieldErrors, updateTodoSchema } from './todo.schema';
import type { TodoService } from './todo.service';

function parse<S extends z.ZodType>(schema: S, data: unknown): z.output<S> {
  const result = schema.safeParse(data);
  if (!result.success) throw new ValidationError(toFieldErrors(result.error));
  return result.data;
}

/** A malformed id can never match a todo, so it gets a 404 rather than a 400. */
function parseId(raw: string): string {
  if (!idSchema.safeParse(raw).success) throw new NotFoundError();
  return raw;
}

/** HTTP adapter: parses input, calls the service, chooses the status code. No domain rules here. */
export function todoRouter(service: TodoService): Router {
  const router = Router();

  router.get('/', (req, res) => {
    const { includeCompleted } = parse(listQuerySchema, req.query);
    res.json(service.list(includeCompleted));
  });

  router.get('/:id', (req, res) => {
    res.json(service.get(parseId(req.params.id)));
  });

  router.post('/', (req, res) => {
    const todo = service.create(parse(createTodoSchema, req.body));
    res.status(201).location(`/api/todos/${todo.id}`).json(todo);
  });

  router.patch('/:id', (req, res) => {
    const id = parseId(req.params.id);
    res.json(service.update(id, parse(updateTodoSchema, req.body)));
  });

  router.delete('/:id', (req, res) => {
    service.delete(parseId(req.params.id));
    res.status(204).end();
  });

  return router;
}
