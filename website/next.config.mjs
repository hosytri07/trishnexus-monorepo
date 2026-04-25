/**
 * Next.js config — TrishTEAM website.
 * Giữ gọn, SSG-first. Images từ Firebase Storage sẽ add remotePatterns ở Phase 11.2.
 *
 * Windows Watchpack noise (EINVAL khi lstat hiberfil.sys / pagefile.sys / ...):
 *   Dùng `WATCHPACK_POLLING=true` trong package.json scripts — polling mode
 *   bypass luôn native file watcher, không cần đụng webpack config.
 *   Đây là cách an toàn nhất, không rủi ro break Next webpack pipeline.
 *
 * Phase 14.7.e — Monorepo workspace packages resolution:
 *   - `transpilePackages`: bắt Next.js SWC transpile code TypeScript
 *     của @trishteam/* (packages export `.ts` nguồn trực tiếp, không build).
 *   - `webpack.resolve.extensionAlias`: TS NodeNext ESM convention bắt import
 *     `./types.js` trong source `.ts`. Webpack không hiểu → alias `.js` về
 *     `.ts/.tsx` để resolve đúng file nguồn.
 *   Cả 2 cần thiết — thiếu cái nào Vercel build cũng fail với
 *   `Module not found: Can't resolve './types.js'`.
 *
 * Phase 14.7.f — CORS cho registry public:
 *   `apps-registry.json` fetch cross-origin từ TrishLauncher desktop (Tauri
 *   WebView2 origin `tauri://localhost` hoặc `https://tauri.localhost`) và
 *   từ dev (`http://localhost:1420`). Browser block nếu response thiếu
 *   `Access-Control-Allow-Origin`. Mở `*` cho file registry public — không
 *   có data nhạy cảm, OK expose. Các route khác giữ default (same-origin).
 */
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    '@trishteam/core',
    '@trishteam/ui',
    '@trishteam/adapters',
    '@trishteam/data',
  ],
  webpack: (config) => {
    // Map `.js` import trong TS source → file `.ts/.tsx` thực tế.
    // Áp cho cả workspace packages + local files. Must-have khi TS dùng
    // moduleResolution: NodeNext/Bundler với "type": "module" trong package.json.
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
      '.cjs': ['.cts', '.cjs'],
    };
    return config;
  },
  async headers() {
    return [
      {
        // Public registry — TrishLauncher desktop fetch cross-origin.
        source: '/apps-registry.json',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Accept, Content-Type' },
          // Cache 5 phút edge, browser revalidate qua etag.
          { key: 'Cache-Control', value: 'public, max-age=0, s-maxage=300, stale-while-revalidate=86400' },
        ],
      },
    ];
  },
  images: {
    // Phase 11.2 sẽ add firebasestorage.googleapis.com
    remotePatterns: [],
  },
};

export default nextConfig;
