import path from 'path';
import { defineConfig } from 'vitest/config';

// Unit-test harness for pure modules (pricing, later: status, queue,
// syncExecutors, reconcile). Node environment — no DOM needed. Mirrors the
// '@' alias from vite.config.ts / tsconfig.json so tests import app modules
// exactly as the app does.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
