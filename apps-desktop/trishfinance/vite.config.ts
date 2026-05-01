import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Phase 27.1.B — PWA support cho web mode
export default defineConfig(({ mode }) => {
  const isWeb = mode === 'web';
  return {
    plugins: [
      react(),
      // Chỉ enable PWA cho web mode (Tauri desktop không cần)
      ...(isWeb
        ? [
            VitePWA({
              registerType: 'autoUpdate',
              includeAssets: ['logo.svg'],
              manifest: {
                name: 'TrishFinance — Quản lý',
                short_name: 'TrishFinance',
                description: 'Quản lý nhà trọ · Tài chính cá nhân · Bán hàng',
                theme_color: '#10b981',
                background_color: '#0f172a',
                display: 'standalone',
                orientation: 'portrait-primary',
                lang: 'vi-VN',
                start_url: '/',
                scope: '/',
                categories: ['finance', 'productivity', 'business'],
                icons: [
                  // SVG scalable icon — Chrome/Edge/Safari đều support
                  {
                    src: '/logo.svg',
                    sizes: 'any',
                    type: 'image/svg+xml',
                    purpose: 'any',
                  },
                  {
                    src: '/logo.svg',
                    sizes: 'any',
                    type: 'image/svg+xml',
                    purpose: 'maskable',
                  },
                ],
              },
              workbox: {
                globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
                runtimeCaching: [
                  {
                    urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/,
                    handler: 'CacheFirst',
                    options: { cacheName: 'gfonts', expiration: { maxAgeSeconds: 60 * 60 * 24 * 365 } },
                  },
                  {
                    urlPattern: /^https:\/\/img\.vietqr\.io\/.*/,
                    handler: 'NetworkFirst',
                    options: { cacheName: 'vietqr', expiration: { maxAgeSeconds: 60 * 60 * 24 * 7 } },
                  },
                ],
              },
            }),
          ]
        : []),
    ],
    clearScreen: false,
    server: {
      port: 3000,
      strictPort: true,
      host: '0.0.0.0',
      hmr: { protocol: 'ws', host: 'localhost', port: 3001 },
      watch: { ignored: ['**/src-tauri/**'] },
    },
    envPrefix: ['VITE_', 'TAURI_'],
    define: {
      // Cho phép code check IS_WEB ở compile time (tree-shake Tauri imports)
      '__IS_WEB__': JSON.stringify(isWeb),
    },
    build: {
      target: 'es2022',
      minify: 'esbuild',
      sourcemap: !isWeb,
      // Web build vào folder riêng để khỏi xung đột với Tauri build
      outDir: isWeb ? 'dist-web' : 'dist',
      // Web mode không cần preserve module cho Tauri runtime
      rollupOptions: isWeb
        ? {
            output: {
              manualChunks: {
                'firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore'],
                'recharts': ['recharts'],
                'react-vendor': ['react', 'react-dom'],
              },
            },
          }
        : undefined,
    },
  };
});
