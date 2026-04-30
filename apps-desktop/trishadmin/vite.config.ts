import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// Phase 24.1.J — bỏ @tailwindcss/vite vì preflight reset của Tailwind v4 phá
// AdminLogin form (input/button background, border-color reset). Drive panel
// dùng utility CSS viết tay trong drive-theme.css thay vì Tailwind framework.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1450,
    strictPort: true,
    host: '127.0.0.1',
    hmr: { protocol: 'ws', host: '127.0.0.1', port: 1451 },
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
    outDir: 'dist',
    emptyOutDir: true,
  },
});
