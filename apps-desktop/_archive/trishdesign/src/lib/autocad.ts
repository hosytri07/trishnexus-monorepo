/**
 * TrishDesign Phase 28.4.E — Frontend wrapper for AutoCAD COM commands.
 *
 * Calls Tauri Rust commands:
 *   - autocad_check_running()       → bool
 *   - autocad_send_commands(cmds[]) → ok | error
 *   - autocad_get_version()          → version string
 */

import { invoke } from '@tauri-apps/api/core';

export interface AutoCadStatus {
  running: boolean;
  version?: string;
  error?: string;
}

export async function autoCadStatus(): Promise<AutoCadStatus> {
  try {
    const running = await invoke<boolean>('autocad_check_running');
    if (!running) return { running: false };
    let version: string | undefined;
    try {
      version = await invoke<string>('autocad_get_version');
    } catch {
      /* ignore — không phải lỗi blocking */
    }
    return { running: true, version };
  } catch (e) {
    return { running: false, error: String(e) };
  }
}

/**
 * Gửi 1 mảng AutoCAD command vào AutoCAD đang chạy.
 * Mỗi command sẽ được nối thêm \n và gửi qua acadDoc.SendCommand().
 *
 * Trả về số command đã thực thi thành công.
 */
export async function autoCadSendCommands(commands: string[]): Promise<number> {
  return invoke<number>('autocad_send_commands', { commands });
}

/**
 * Tạo + activate Document mới (newDoc) nếu cần.
 * Gọi trước khi vẽ để đảm bảo có không gian sạch.
 */
export async function autoCadEnsureDocument(): Promise<void> {
  return invoke<void>('autocad_ensure_document');
}

export interface HatchDeployResult {
  installedCount: number;
  paths: string[];
  bytes: number;
  summary: string;
}

/**
 * Auto-detect AutoCAD support folders + ghi pattern file vào tất cả version cài.
 * Returns summary để hiển thị cho user.
 */
export async function deployHatchPatterns(): Promise<HatchDeployResult> {
  return invoke<HatchDeployResult>('deploy_hatch_patterns');
}

/**
 * Scan tất cả .shx font files trong AutoCAD installation folders (Program Files).
 */
export async function listAutoCadShxFonts(): Promise<string[]> {
  return invoke<string[]>('list_autocad_shx_fonts');
}
