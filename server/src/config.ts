export interface Config {
  host: string;
  port: number;
  dbPath: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const port = Number(env.PORT ?? 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT: ${env.PORT}`);
  }
  return {
    host: env.HOST ?? '127.0.0.1', // no auth, so do not listen on the network by default
    port,
    dbPath: env.DB_PATH ?? 'data/todos.db',
  };
}
