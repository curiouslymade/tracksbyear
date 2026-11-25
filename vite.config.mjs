import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import sitePlugin from './scripts/vite-plugin-site.mjs';

// Keep one fixed local address. The browser keeps the saved songs for each address,
// so a different host or port opens an empty timeline.
export default defineConfig({
  plugins: [react(), sitePlugin()],
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  build: {
    // No data: URIs, so the Content Security Policy can stay at 'self'.
    assetsInlineLimit: 0,
    target: 'es2022',
  },
  // Vitest runs the app tests in src/. The build tests in test/ use node:test.
  test: { include: ['src/**/*.test.ts'] },
});
