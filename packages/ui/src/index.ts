/**
 * @trishteam/ui — shared React components.
 *
 * Phase 14.0 scaffold — chưa có component nào ở đây. Phase 14.1 migrate dần
 * từ website/components/* (ưu tiên widget dashboard có thể re-use cho Zalo).
 *
 * Rule thiết kế:
 * - Component KHÔNG import CSS Module (Zalo Mini App không hỗ trợ CSS Modules
 *   y hệt Next.js). Dùng tailwind-compatible className props + slot pattern.
 * - Không hardcode next/link, next/image — nhận component qua props hoặc
 *   import từ @trishteam/adapters.
 * - Theme tokens đọc qua CSS custom properties — mỗi host platform setup
 *   tokens ở root.
 */

export const UI_VERSION = '0.1.0';
