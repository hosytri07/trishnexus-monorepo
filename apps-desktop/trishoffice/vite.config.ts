import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

// Phase 38.6 — TrishOffice scaffold. Cùng pattern với TrishISO.
export default defineConfig(() => {
  return {
    base: './',
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      assetsInlineLimit: 4096,
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
