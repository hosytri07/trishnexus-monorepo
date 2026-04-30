import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    // base: './' để asset path tương đối, mở file:// được
    base: './',
    plugins: [
      react(),
      tailwindcss(),
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      // Output folder dist/ với index.html + assets/, mở file:// chạy được
      // (singlefile bundle + React 19 + file:// origin có conflict)
      assetsInlineLimit: 4096,
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
