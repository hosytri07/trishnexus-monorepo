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
  images: {
    // Phase 11.2 sẽ add firebasestorage.googleapis.com
    remotePatterns: [],
  },
};

export default nextConfig;
