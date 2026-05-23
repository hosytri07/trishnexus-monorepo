import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1426,
    strictPort: true,
    host: '127.0.0.1',
    hmr: { protocol: 'ws', host: '127.0.0.1', port: 1427 },
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
});
