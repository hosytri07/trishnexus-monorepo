import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

/**
 * Tauri 2 Vite config.
 *
 * - Fixed port 1420 — Tauri expects dev server ở đây.
 * - strictPort = true để fail sớm nếu port bị chiếm.
 * - envPrefix thêm 'TAURI_ENV_*' để client code đọc được env riêng
 *   của Tauri (ví dụ: platform, arch).
 * - `@trishteam/*` packages được resolve qua pnpm workspace symlink ở
 *   `node_modules/@trishteam/<pkg>` + `exports` field trong package.json,
 *   KHÔNG dùng alias trực tiếp (alias string-prefix-match sẽ phá subpath
 *   imports như `@trishteam/core/apps`).
 */
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: '127.0.0.1',
    hmr: {
      protocol: 'ws',
      host: '127.0.0.1',
      port: 1421,
    },
  },
  envPrefix: ['VITE_', 'TAURI_ENV_'],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    target: 'es2022',
    minify: 'esbuild',
    sourcemap: false,
    outDir: 'dist',
    emptyOutDir: true,
  },
});
