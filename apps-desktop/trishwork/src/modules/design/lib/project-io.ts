/**
 * TrishDesign Phase 28.4.G — Project export/import (JSON).
 *
 * Định dạng file: `.tdproject.json` (JSON pretty-print 2 spaces).
 * Magic + version để verify khi nhập ngược.
 *
 * Snapshot 1 hồ sơ ĐẦY ĐỦ:
 *   - project (toàn bộ segments + damagePieces + stakes)
 *   - damageCodes (snapshot mã hư hỏng tại thời điểm xuất, để máy nhập có
 *     đúng layer/hatch dù admin sau đó đổi mã)
 *
 * KHÔNG snapshot drawingPrefs (mỗi máy có cài đặt riêng) hoặc activeProjectId.
 */
import type { Project, DamageCode } from '../types.js';

const FILE_MAGIC = 'TRISHDESIGN_PROJECT';
const FILE_VERSION = 1;

export interface ProjectExportFile {
  magic: string;
  version: number;
  exportedAt: number; // unix ms
  appVersion?: string; // optional — useful debug
  project: Project;
  damageCodes: DamageCode[];
}

/** Tạo JSON string xuất file. Pretty-print 2 spaces cho dễ đọc/diff. */
export function serializeProject(
  project: Project,
  damageCodes: DamageCode[],
  appVersion?: string,
): string {
  const payload: ProjectExportFile = {
    magic: FILE_MAGIC,
    version: FILE_VERSION,
    exportedAt: Date.now(),
    appVersion,
    project,
    damageCodes,
  };
  return JSON.stringify(payload, null, 2);
}

/** Parse + validate JSON file. Throw lỗi tiếng Việt nếu không hợp lệ. */
export function parseProjectFile(json: string): ProjectExportFile {
  let obj: ProjectExportFile;
  try {
    obj = JSON.parse(json) as ProjectExportFile;
  } catch {
    throw new Error('File JSON không đúng định dạng (lỗi parse).');
  }
  if (!obj || typeof obj !== 'object') {
    throw new Error('File rỗng hoặc không phải object.');
  }
  if (obj.magic !== FILE_MAGIC) {
    throw new Error(
      `File không phải hồ sơ TrishDesign (magic = "${String(obj.magic)}").`,
    );
  }
  if (typeof obj.version !== 'number' || obj.version > FILE_VERSION) {
    throw new Error(
      `Phiên bản file (v${obj.version}) cao hơn app — vui lòng cập nhật TrishDesign.`,
    );
  }
  if (!obj.project || typeof obj.project !== 'object') {
    throw new Error('File thiếu field "project".');
  }
  if (!Array.isArray(obj.project.segments)) {
    throw new Error('File "project.segments" không phải array.');
  }
  if (!Array.isArray(obj.damageCodes)) {
    // backward-compat — file cũ có thể không có damageCodes
    obj.damageCodes = [];
  }
  return obj;
}

/** Suggest filename cho dialog xuất */
export function suggestExportFilename(projectName: string): string {
  const safe = projectName.replace(/[^\w\s\-+.()]/g, '_').trim() || 'Project';
  const ts = new Date().toISOString().slice(0, 10); // 2026-05-04
  return `${safe}_${ts}.tdproject.json`;
}
