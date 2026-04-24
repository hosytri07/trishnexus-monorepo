/**
 * Tailwind config cho TrishTEAM website.
 * Theme object đọc từ assets/tailwind.theme.cjs — AUTO-GENERATED từ design/tokens.v2.json.
 * Regen tokens:  npm run tokens:sync
 * Check drift:   npm run tokens:check   (CI chạy lệnh này)
 *
 * Dark/Light switching:
 *   Dark (default) : <html> không có attr
 *   Light          : <html data-theme="light">
 *   CSS vars trong assets/tokens.css tự swap dựa trên [data-theme].
 *
 * `darkMode: 'class'` để sau này nếu cần toggle dark lại bằng class .dark
 * (hiện tại dark là default, không cần toggle — nhưng giữ cho tương thích shadcn/ui).
 */
/** @type {import('tailwindcss').Config} */
const tokens = require('./assets/tailwind.theme.cjs');

module.exports = {
  darkMode: ['class', '[data-theme="dark"]'],
  content: [
    './app/**/*.{ts,tsx,js,jsx,mdx}',
    './components/**/*.{ts,tsx,js,jsx,mdx}',
    './lib/**/*.{ts,tsx,js,jsx}',
  ],
  theme: {
    extend: {
      ...tokens,
      // Override fontFamily.display để pick up CSS var từ next/font (layout.tsx).
      // Fallback stack = tokens.fontFamily.display + system sans.
      fontFamily: {
        ...tokens.fontFamily,
        display: ['var(--font-display)', ...tokens.fontFamily.display],
        body: ['var(--font-display)', ...tokens.fontFamily.body],
      },
    },
  },
  plugins: [],
};
