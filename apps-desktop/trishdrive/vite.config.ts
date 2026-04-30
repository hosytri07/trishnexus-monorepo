import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  build: { assetsInlineLimit: 4096 },
  server: {
    port: 3001,
    strictPort: true,
    host: '0.0.0.0',
  },
});
