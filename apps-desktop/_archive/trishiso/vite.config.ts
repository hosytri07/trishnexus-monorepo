import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

// Phase 24.3 — bỏ @tailwindcss/vite (design-system package tự ship utility CSS).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    base: './',
    plugins: [react()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
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
