import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    coverage: {
      reporter: ['text', 'json-summary'],
      include: ['lib/**/*.ts', 'components/**/*.tsx']
    }
  },
  resolve: {
    alias: {
      '@': new URL('.', import.meta.url).pathname
    }
  }
});
