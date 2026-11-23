import { defineConfig } from 'vitest/config';

// `npm run dev` talks to the stack started by docker compose (Traefik on localhost).
const stack = process.env.RTC_STACK_URL ?? 'http://localhost';

export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      '/api': { target: stack, changeOrigin: true },
      '/health': { target: stack, changeOrigin: true },
    },
  },
  build: { outDir: 'dist', sourcemap: false },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
