import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Phase 24.3.G — bỏ @tailwindcss/vite (design-system package tự ship utility CSS).
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { assetsInlineLimit: 4096 },
  server: {
    port: 3001,
    strictPort: true,
    host: '0.0.0.0',
  },
});
