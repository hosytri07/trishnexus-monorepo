import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// @trishteam/trishwork - Phase 44. Tauri 2 dev port 1440 (khac voi Library 1434).
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1440,
    strictPort: true,
    host: '127.0.0.1',
    hmr: { protocol: 'ws', host: '127.0.0.1', port: 1441 },
  },
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    target: 'es2022',
    sourcemap: false,
    outDir: 'dist',
  },
});
