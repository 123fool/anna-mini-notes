import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'bundle',
    // The host serves this SDK. Bundling it makes strict ACL validation scan SDK internals.
    rollupOptions: {
      external: ['@anna-ai/app-runtime'],
      output: { paths: { '@anna-ai/app-runtime': '/static/anna-apps/_sdk/latest/index.js' } },
    },
  },
  test: { environment: 'jsdom', include: ['src/**/*.test.{ts,tsx}'] },
});
