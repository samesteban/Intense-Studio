import path from 'path';
import { defineConfig } from 'vitest/config';

// Test harness, split by environment:
//   - Node for pure-module unit tests (pricing, status, queue, syncExecutors,
//     reconcile, mappers, cache, sync). No DOM needed.
//   - jsdom for React component tests (Header, modals, tabs). jest-dom matchers
//     are registered in src/test/setup.ts.
// Mirrors the '@' alias from vite.config.ts / tsconfig.json so tests import app
// modules exactly as the app does.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    // Component (.test.tsx) specs opt into jsdom via the
    // `// @vitest-environment jsdom` docblock (see Header.test.tsx).
    // globals enables @testing-library/react auto-cleanup (afterEach) so each
    // render is unmounted before the next test. Tests still import named
    // exports explicitly, so no TS global-type changes are needed.
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
});