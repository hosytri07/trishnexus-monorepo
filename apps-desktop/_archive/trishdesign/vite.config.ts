import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

/**
 * TrishDesign dev port 1438 (HMR 1439) — không đụng apps khác:
 *   launcher 1420, check 1422, clean 1424, font 1426, type 1428,
 *   image 1430, note 1432, library 1434, search 1436, design 1438.
 */
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1438,
    strictPort: true,
    host: '127.0.0.1',
    hmr: { protocol: 'ws', host: '127.0.0.1', port: 1439 },
  },
  envPrefix: ['VITE_', 'TAURI_ENV_'],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // @trishteam/* resolve qua pnpm symlink + exports field — KHÔNG alias
      // tới src/index.ts vì prefix-match sẽ phá subpath như /apps, /clean…
    },
  },
  build: {
    target: 'es2022',
    minify: 'esbuild',
    outDir: 'dist',
    emptyOutDir: true,
  },
  optimizeDeps: {
    // Pre-bundle xlsx (CJS) cho Vite ESM dev server
    include: ['xlsx'],
  },
});
