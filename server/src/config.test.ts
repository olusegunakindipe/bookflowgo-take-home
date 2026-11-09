import { describe, expect, it } from 'vitest';
import { loadConfig } from './config';

describe('loadConfig', () => {
  it('uses safe defaults', () => {
    expect(loadConfig({})).toEqual({ host: '127.0.0.1', port: 3001, dbPath: 'data/todos.db' });
  });

  it('reads overrides from the environment', () => {
    expect(loadConfig({ HOST: '0.0.0.0', PORT: '4000', DB_PATH: '/tmp/x.db' }))
      .toEqual({ host: '0.0.0.0', port: 4000, dbPath: '/tmp/x.db' });
  });

  it('fails fast on an invalid port', () => {
    expect(() => loadConfig({ PORT: 'abc' })).toThrow('Invalid PORT');
    expect(() => loadConfig({ PORT: '70000' })).toThrow('Invalid PORT');
  });
});
