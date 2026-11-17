import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: { alias: { '@core': path.resolve(__dirname, '../../packages/core/src'), '@': path.resolve(__dirname) } },
  esbuild: { jsx: 'automatic' }, // compiled screens (.jsx) use the automatic runtime, like Next
  test: { environment: 'node', include: ['tests/**/*.test.ts'], testTimeout: 20000 },
});
