/**
 * Phase 17.6 v2 — TrishType.
 *
 * Note: bridge cũ đã refactor — App.tsx, ConvertPanel.tsx, SettingsModal.tsx
 * dùng `invoke` trực tiếp từ `@tauri-apps/api/core`. File này chỉ giữ
 * 1 helper isInTauri để tránh phá lockfile.
 */

export function isInTauri(): boolean {
  return (
    typeof window !== 'undefined' &&
    // @ts-expect-error — __TAURI_INTERNALS__ injected at runtime
    typeof window.__TAURI_INTERNALS__ !== 'undefined'
  );
}
