import express, { type Express } from 'express';
import helmet from 'helmet';
import { errorHandler, notFoundHandler, requireJsonBody } from './http/middleware';
import type { TodoRepository } from './todos/todo.repository';
import { todoRouter } from './todos/todo.routes';
import { TodoService } from './todos/todo.service';

/** Builds the app from its dependencies (no listen), so tests can inject an in-memory repository. */
export function createApp(repo: TodoRepository): Express {
  const app = express();
  app.use(helmet());
  app.use(requireJsonBody);
  app.use(express.json({ limit: '10kb' }));
  app.use('/api/todos', todoRouter(new TodoService(repo)));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
