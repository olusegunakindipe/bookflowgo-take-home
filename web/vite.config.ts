/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // API_URL (shell or .env) overrides the default, matching the server's HOST/PORT config.
  // No VITE_ prefix on purpose: this is dev-server config and must not reach the browser bundle.
  const env = loadEnv(mode, '.', '');
  const apiUrl = env.API_URL || 'http://127.0.0.1:3001';

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      proxy: { '/api': apiUrl }, // same-origin in dev → no CORS needed
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      restoreMocks: true,
      unstubGlobals: true,
    },
  };
});
