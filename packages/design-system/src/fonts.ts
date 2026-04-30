/**
 * Plus Jakarta Sans — JS imports để Vite bundle font woff2 đúng cách.
 * Consumer apps `import '@trishteam/design-system/fonts'` ở main entry để
 * font load trước khi render React tree.
 *
 * Tham khảo Phase 24.1: nếu chỉ @import qua CSS thì có thể bị Vite plugin
 * (Tailwind v4) strip — JS import an toàn hơn.
 */
import '@fontsource/plus-jakarta-sans/400.css';
import '@fontsource/plus-jakarta-sans/500.css';
import '@fontsource/plus-jakarta-sans/600.css';
import '@fontsource/plus-jakarta-sans/700.css';
