/**
 * Next.js config — TrishTEAM website.
 * Giữ gọn, SSG-first. Images từ Firebase Storage sẽ add remotePatterns ở Phase 11.2.
 *
 * Windows Watchpack noise (EINVAL khi lstat hiberfil.sys / pagefile.sys / ...):
 *   Dùng `WATCHPACK_POLLING=true` trong package.json scripts — polling mode
 *   bypass luôn native file watcher, không cần đụng webpack config.
 *   Đây là cách an toàn nhất, không rủi ro break Next webpack pipeline.
 */
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Phase 11.2 sẽ add firebasestorage.googleapis.com
    remotePatterns: [],
  },
};

export default nextConfig;
