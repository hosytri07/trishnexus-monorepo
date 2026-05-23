import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// @trishteam/trishutilities - Phase 44. Port 1442 (Work=1440, Library=1434).
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1442,
    strictPort: true,
    host: '127.0.0.1',
    hmr: { protocol: 'ws', host: '127.0.0.1', port: 1443 },
  },
  envPrefix: ['VITE_', 'TAURI_'],
  build: { target: 'es2022', sourcemap: false, outDir: 'dist' },
});
