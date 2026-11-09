import { createApp } from './app';
import { loadConfig } from './config';
import { openDatabase, type Db } from './db/database';
import { createSqliteTodoRepository } from './todos/todo.repository';

const config = loadConfig();

let db: Db;
try {
  db = openDatabase(config.dbPath);
} catch (err) {
  console.error('Failed to open database:', err);
  process.exit(1); // fail fast: never serve in a half-working state
}

const app = createApp(createSqliteTodoRepository(db));
const server = app.listen(config.port, config.host, () => {
  console.log(`ToDo API listening on http://${config.host}:${config.port}`);
});

function shutdown(signal: string): void {
  console.log(`${signal} received, shutting down`);
  server.close(() => {
    db.close();
    process.exit(0);
  });
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
