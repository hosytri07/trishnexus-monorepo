/**
 * Types cho launch detection — kiểm tra app đã cài hay chưa.
 *
 * Detection strategy: path probe. Với mỗi app + platform, liệt kê 1-4
 * candidate paths (support env var expansion qua Rust). Path đầu tiên
 * tồn tại → app đã cài, lưu full resolved path để launch sau này.
 *
 * Probe KHÔNG check registry Windows / bundle identifier macOS /
 * desktop entry detailed parsing — giữ đơn giản cho v1. Khi cần edge
 * case (user install custom path) có thể mở rộng Phase 14.5.5.c.1.
 *
 * Phase 14.5.5.c — 2026-04-24.
 */
import type { Platform } from '@trishteam/core/apps';

/**
 * Candidate paths mỗi platform để probe xem app đã cài chưa.
 * Support env var trong Rust: `$HOME`, `%LOCALAPPDATA%`, `%APPDATA%`,
 * `%PROGRAMFILES%`, `~` (alias cho $HOME).
 */
export type InstallCandidates = Partial<Record<Platform, string[]>>;

export type InstallState = 'installed' | 'not_installed';

/** Kết quả detect cho 1 app. */
export interface InstallDetection {
  /** App id (match với AppRegistryEntry.id). */
  id: string;
  /** Trạng thái detection cho platform hiện tại. */
  state: InstallState;
  /** Full resolved path nếu installed, null nếu not_installed. */
  path: string | null;
}

/** Input probe cho Rust — 1 app × N candidates resolved cho platform hiện tại. */
export interface InstallProbe {
  id: string;
  candidates: string[];
}
