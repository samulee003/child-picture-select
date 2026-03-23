import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      electron: resolve(__dirname, '__mocks__/electron.js'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    exclude: [
      'tests/e2e/**',
      'node_modules/**',
      '.claude/**',
    ],
    server: {
      deps: {
        inline: ['sharp', 'better-sqlite3']
      }
    }
  }
});

