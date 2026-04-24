/**
 * @trishteam/adapters — platform abstraction interfaces.
 *
 * Phase 14.0 scaffold. Các shared component/logic dùng những interface này
 * thay vì import trực tiếp next/link / zmp-navigation / tauri-api.
 *
 * Mỗi host cung cấp implementation ở bootstrap:
 *   website:   import { RouterAdapter } from '@trishteam/adapters';
 *              const router: RouterAdapter = nextRouterImpl(useRouter());
 *   desktop:   const router: RouterAdapter = tauriRouterImpl();
 *   zalo:      const router: RouterAdapter = zmpRouterImpl();
 */

/** Routing — push/replace/back, đọc path hiện tại. */
export interface RouterAdapter {
  readonly pathname: string;
  push(path: string): void;
  replace(path: string): void;
  back(): void;
}

/** Key-value storage persistent (localStorage trên web, filesystem ở desktop). */
export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Toast/notification — UI khác nhau giữa platform, interface chung. */
export interface NotificationAdapter {
  info(message: string): void;
  success(message: string): void;
  error(message: string): void;
  warn(message: string): void;
}

/** Clipboard — navigator.clipboard trên web, Tauri API ở desktop. */
export interface ClipboardAdapter {
  writeText(text: string): Promise<void>;
  readText?(): Promise<string>;
}

/**
 * Tập hợp adapters — host compose rồi pass qua context. Shared code nhận
 * một instance, không quan tâm chi tiết implement.
 */
export interface PlatformAdapters {
  router: RouterAdapter;
  storage: StorageAdapter;
  notify: NotificationAdapter;
  clipboard: ClipboardAdapter;
}

export const ADAPTERS_VERSION = '0.1.0';
