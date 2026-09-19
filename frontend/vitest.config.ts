import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  define: {
    'import.meta.env.VITE_USE_MOCK_API': JSON.stringify('true'),
  },
  test: {
    globals: true,
    environment: 'node',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
