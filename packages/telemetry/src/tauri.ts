/**
 * @trishteam/telemetry/tauri — adapter cho 7 desktop app Tauri 2.
 *
 * Khác browser.ts:
 *   - Set endpoint base = https://trishteam.io.vn (không phải same-origin)
 *   - Thêm reportTauriPanic() — gọi từ Rust qua tauri::emit khi Rust panic
 *   - Tự đính kèm app version từ Tauri API getVersion()
 *
 * Flow:
 *   1. App entry (src/main.tsx) gọi installTauriTelemetry({ app: 'trishlibrary' })
 *   2. Rust side: setup panic hook trong src-tauri/src/lib.rs:
 *        std::panic::set_hook(Box::new(|info| {
 *          app.emit("trishteam://panic", PanicPayload { ... }).ok();
 *        }));
 *   3. JS side: listen "trishteam://panic" → reportError()
 *
 * Phase 21 prep — wire vào 7 app sau khi tạo package này.
 */

import { ErrorPayload, VitalPayload } from './index.js';
import { reportError, reportVital, installErrorHandlers, setEndpointBase, InstallOptions } from './browser.js';

/** Endpoint cho desktop app — luôn trỏ production. */
export const TRISHTEAM_TELEMETRY_ENDPOINT = 'https://trishteam.io.vn';

export interface TauriInstallOptions extends Omit<InstallOptions, 'platform'> {
  /** Override endpoint cho dev/test, mặc định production. */
  endpoint?: string;
  /** Tauri panic event name, mặc định "trishteam://panic" */
  panicEventName?: string;
}

/**
 * Cài đặt telemetry cho 1 desktop app Tauri:
 *  - Set endpoint base = production
 *  - Cài window.onerror + unhandledrejection handler
 *  - Listen Tauri panic event và forward sang reportError()
 *
 * Cách dùng (trong src/main.tsx của app):
 * ```ts
 * import { installTauriTelemetry } from '@trishteam/telemetry/tauri';
 * import packageJson from '../package.json';
 *
 * installTauriTelemetry({
 *   app: 'trishlibrary',
 *   version: packageJson.version,
 *   uid: () => getCurrentFirebaseUid(),
 * });
 * ```
 */
export async function installTauriTelemetry(opts: TauriInstallOptions): Promise<() => void> {
  setEndpointBase(opts.endpoint || TRISHTEAM_TELEMETRY_ENDPOINT);

  const cleanupHandlers = installErrorHandlers({
    app: opts.app,
    version: opts.version,
    platform: 'windows_x64', // 7 app TrishTEAM hiện chỉ build Windows x64
    uid: opts.uid,
  });

  let unlistenPanic: (() => void) | undefined;

  // Lazy-load @tauri-apps/api để tránh fail khi build website (không có Tauri)
  try {
    const eventModule = await import(/* @vite-ignore */ '@tauri-apps/api/event');
    const eventName = opts.panicEventName || 'trishteam://panic';
    unlistenPanic = await eventModule.listen<PanicPayload>(eventName, (event) => {
      reportError({
        app: opts.app,
        version: opts.version,
        platform: 'windows_x64',
        severity: 'fatal',
        name: 'RustPanic',
        message: event.payload?.message || 'Rust panic (no message)',
        stack: event.payload?.location,
        context: { thread: event.payload?.thread },
        uid: opts.uid?.(),
      });
    });
  } catch {
    // Tauri không có (vd build website embed package này) — bỏ qua
  }

  return () => {
    cleanupHandlers();
    unlistenPanic?.();
  };
}

interface PanicPayload {
  message?: string;
  location?: string;
  thread?: string;
}

/**
 * Helper: gọi reportError thủ công cho lỗi đã catch (try/catch của user).
 */
export function reportTauriError(
  app: string,
  version: string,
  err: unknown,
  context?: Record<string, unknown>,
  uid?: string
): void {
  const isError = err instanceof Error;
  reportError({
    app,
    version,
    platform: 'windows_x64',
    severity: 'error',
    name: isError ? err.name : 'UnknownError',
    message: isError ? err.message : String(err).slice(0, 1024),
    stack: isError ? err.stack : undefined,
    context,
    uid,
  });
}

/**
 * Helper: report startup time (cold launch) — gọi sau khi app render xong.
 */
export function reportStartupTime(app: string, version: string, ms: number, uid?: string): void {
  reportVital({
    app,
    version,
    platform: 'windows_x64',
    name: 'STARTUP',
    value: ms,
    uid,
  });
}

// Re-export common API
export { reportError, reportVital };
export type { ErrorPayload, VitalPayload };
