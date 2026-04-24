/**
 * Install candidates — path probe cho 9 app (launcher self-exclude).
 *
 * Với mỗi app × platform: list path ứng viên, probe trong Rust qua
 * `std::path::Path::exists()`. Path đầu tiên tồn tại = app đã cài.
 *
 * Convention cài đặt mặc định Tauri:
 * - Windows: `%LOCALAPPDATA%\Programs\<AppName>\<AppName>.exe` (NSIS
 *   current-user) hoặc `%PROGRAMFILES%\<AppName>\<AppName>.exe` (NSIS
 *   all-users / MSI). Thử cả 2 để phủ case Trí chọn khi cài.
 * - macOS: `/Applications/<AppName>.app` (drag-drop DMG chuẩn) hoặc
 *   `~/Applications/<AppName>.app` (user-only install).
 * - Linux: desktop entry `~/.local/share/applications/vn.trishteam.
 *   <id>.desktop` (user) hoặc `/usr/share/applications/...` (system
 *   .deb). Path bin thường ở `/usr/bin/<id>` nếu .deb, hoặc
 *   `$HOME/.local/bin/<id>` nếu AppImage user-setup.
 *
 * **Dev-mode detection** (Phase 14.5.5.c.1): thêm candidate path
 * `%EXE_DIR%\<appid>.exe` (Windows) / `%EXE_DIR%/<appid>` (Unix) đầu
 * list. Rust resolve `%EXE_DIR%` về `current_exe().parent()` — trong
 * dev mode launcher ở `<repo>/target-desktop/debug/trishlauncher.exe`
 * nên sibling binary `<repo>/target-desktop/debug/trishnote.exe` sẽ
 * được detect. Production launcher ở `%LOCALAPPDATA%\Programs\
 * TrishLauncher\` → sibling không tồn tại → fallback sang path
 * `%LOCALAPPDATA%\Programs\TrishNote\...` như bình thường.
 *
 * **AppName convention**: Tauri bundle với `productName` field trong
 * `tauri.conf.json`. Bản hiện tại dùng PascalCase (TrishClean,
 * TrishNote…) cho binary + dir, và id kebab-case `vn.trishteam.
 * <id>` cho bundle identifier. Tuy nhiên `Cargo.toml` name field (=
 * tên binary cargo build ra) đang là lowercase (`trishnote`,
 * `trishcheck`…), nên dev-mode candidate dùng lowercase.
 *
 * Env var expansion trong Rust: `%LOCALAPPDATA%`, `%APPDATA%`,
 * `%PROGRAMFILES%`, `%EXE_DIR%`, `$HOME`, `~/` được resolve qua helper
 * `expand_path()` — xem `src-tauri/src/lib.rs`.
 *
 * Phase 14.5.5.c — 2026-04-24 (created).
 * Phase 14.5.5.c.1 — 2026-04-24 (dev-mode %EXE_DIR%).
 */
import type { InstallCandidates } from './install-types.js';

/**
 * Candidates cho 9 app (không có trishlauncher — launcher tự biết
 * mình chạy ở đâu, không cần probe). Map theo `app.id` trong
 * `SEED_REGISTRY`.
 *
 * Thứ tự candidate: dev binary → production current-user → production
 * all-users → macOS DMG → macOS user → Linux user desktop → Linux
 * system desktop → Linux /usr/bin. Path đầu tiên match = app đã cài.
 */
export const INSTALL_CANDIDATES: Record<string, InstallCandidates> = {
  trishcheck: {
    windows_x64: [
      '%EXE_DIR%\\trishcheck.exe',
      '%LOCALAPPDATA%\\Programs\\TrishCheck\\TrishCheck.exe',
      '%PROGRAMFILES%\\TrishCheck\\TrishCheck.exe',
    ],
    windows_arm64: [
      '%EXE_DIR%\\trishcheck.exe',
      '%LOCALAPPDATA%\\Programs\\TrishCheck\\TrishCheck.exe',
      '%PROGRAMFILES%\\TrishCheck\\TrishCheck.exe',
    ],
    macos_x64: [
      '%EXE_DIR%/trishcheck',
      '/Applications/TrishCheck.app',
      '~/Applications/TrishCheck.app',
    ],
    macos_arm64: [
      '%EXE_DIR%/trishcheck',
      '/Applications/TrishCheck.app',
      '~/Applications/TrishCheck.app',
    ],
    linux_x64: [
      '%EXE_DIR%/trishcheck',
      '~/.local/share/applications/vn.trishteam.trishcheck.desktop',
      '/usr/share/applications/vn.trishteam.trishcheck.desktop',
      '/usr/bin/trishcheck',
    ],
  },
  trishclean: {
    windows_x64: [
      '%EXE_DIR%\\trishclean.exe',
      '%LOCALAPPDATA%\\Programs\\TrishClean\\TrishClean.exe',
      '%PROGRAMFILES%\\TrishClean\\TrishClean.exe',
    ],
    windows_arm64: [
      '%EXE_DIR%\\trishclean.exe',
      '%LOCALAPPDATA%\\Programs\\TrishClean\\TrishClean.exe',
      '%PROGRAMFILES%\\TrishClean\\TrishClean.exe',
    ],
    macos_x64: [
      '%EXE_DIR%/trishclean',
      '/Applications/TrishClean.app',
      '~/Applications/TrishClean.app',
    ],
    macos_arm64: [
      '%EXE_DIR%/trishclean',
      '/Applications/TrishClean.app',
      '~/Applications/TrishClean.app',
    ],
    linux_x64: [
      '%EXE_DIR%/trishclean',
      '~/.local/share/applications/vn.trishteam.trishclean.desktop',
      '/usr/share/applications/vn.trishteam.trishclean.desktop',
      '/usr/bin/trishclean',
    ],
  },
  trishfont: {
    windows_x64: [
      '%EXE_DIR%\\trishfont.exe',
      '%LOCALAPPDATA%\\Programs\\TrishFont\\TrishFont.exe',
      '%PROGRAMFILES%\\TrishFont\\TrishFont.exe',
    ],
    windows_arm64: [
      '%EXE_DIR%\\trishfont.exe',
      '%LOCALAPPDATA%\\Programs\\TrishFont\\TrishFont.exe',
      '%PROGRAMFILES%\\TrishFont\\TrishFont.exe',
    ],
    macos_x64: [
      '%EXE_DIR%/trishfont',
      '/Applications/TrishFont.app',
      '~/Applications/TrishFont.app',
    ],
    macos_arm64: [
      '%EXE_DIR%/trishfont',
      '/Applications/TrishFont.app',
      '~/Applications/TrishFont.app',
    ],
    linux_x64: [
      '%EXE_DIR%/trishfont',
      '~/.local/share/applications/vn.trishteam.trishfont.desktop',
      '/usr/share/applications/vn.trishteam.trishfont.desktop',
      '/usr/bin/trishfont',
    ],
  },
  trishtype: {
    windows_x64: [
      '%EXE_DIR%\\trishtype.exe',
      '%LOCALAPPDATA%\\Programs\\TrishType\\TrishType.exe',
      '%PROGRAMFILES%\\TrishType\\TrishType.exe',
    ],
    windows_arm64: [
      '%EXE_DIR%\\trishtype.exe',
      '%LOCALAPPDATA%\\Programs\\TrishType\\TrishType.exe',
      '%PROGRAMFILES%\\TrishType\\TrishType.exe',
    ],
    macos_x64: [
      '%EXE_DIR%/trishtype',
      '/Applications/TrishType.app',
      '~/Applications/TrishType.app',
    ],
    macos_arm64: [
      '%EXE_DIR%/trishtype',
      '/Applications/TrishType.app',
      '~/Applications/TrishType.app',
    ],
    linux_x64: [
      '%EXE_DIR%/trishtype',
      '~/.local/share/applications/vn.trishteam.trishtype.desktop',
      '/usr/share/applications/vn.trishteam.trishtype.desktop',
      '/usr/bin/trishtype',
    ],
  },
  trishimage: {
    windows_x64: [
      '%EXE_DIR%\\trishimage.exe',
      '%LOCALAPPDATA%\\Programs\\TrishImage\\TrishImage.exe',
      '%PROGRAMFILES%\\TrishImage\\TrishImage.exe',
    ],
    windows_arm64: [
      '%EXE_DIR%\\trishimage.exe',
      '%LOCALAPPDATA%\\Programs\\TrishImage\\TrishImage.exe',
      '%PROGRAMFILES%\\TrishImage\\TrishImage.exe',
    ],
    macos_x64: [
      '%EXE_DIR%/trishimage',
      '/Applications/TrishImage.app',
      '~/Applications/TrishImage.app',
    ],
    macos_arm64: [
      '%EXE_DIR%/trishimage',
      '/Applications/TrishImage.app',
      '~/Applications/TrishImage.app',
    ],
    linux_x64: [
      '%EXE_DIR%/trishimage',
      '~/.local/share/applications/vn.trishteam.trishimage.desktop',
      '/usr/share/applications/vn.trishteam.trishimage.desktop',
      '/usr/bin/trishimage',
    ],
  },
  trishnote: {
    windows_x64: [
      '%EXE_DIR%\\trishnote.exe',
      '%LOCALAPPDATA%\\Programs\\TrishNote\\TrishNote.exe',
      '%PROGRAMFILES%\\TrishNote\\TrishNote.exe',
    ],
    windows_arm64: [
      '%EXE_DIR%\\trishnote.exe',
      '%LOCALAPPDATA%\\Programs\\TrishNote\\TrishNote.exe',
      '%PROGRAMFILES%\\TrishNote\\TrishNote.exe',
    ],
    macos_x64: [
      '%EXE_DIR%/trishnote',
      '/Applications/TrishNote.app',
      '~/Applications/TrishNote.app',
    ],
    macos_arm64: [
      '%EXE_DIR%/trishnote',
      '/Applications/TrishNote.app',
      '~/Applications/TrishNote.app',
    ],
    linux_x64: [
      '%EXE_DIR%/trishnote',
      '~/.local/share/applications/vn.trishteam.trishnote.desktop',
      '/usr/share/applications/vn.trishteam.trishnote.desktop',
      '/usr/bin/trishnote',
    ],
  },
  trishlibrary: {
    windows_x64: [
      '%EXE_DIR%\\trishlibrary.exe',
      '%LOCALAPPDATA%\\Programs\\TrishLibrary\\TrishLibrary.exe',
      '%PROGRAMFILES%\\TrishLibrary\\TrishLibrary.exe',
    ],
    windows_arm64: [
      '%EXE_DIR%\\trishlibrary.exe',
      '%LOCALAPPDATA%\\Programs\\TrishLibrary\\TrishLibrary.exe',
      '%PROGRAMFILES%\\TrishLibrary\\TrishLibrary.exe',
    ],
    macos_x64: [
      '%EXE_DIR%/trishlibrary',
      '/Applications/TrishLibrary.app',
      '~/Applications/TrishLibrary.app',
    ],
    macos_arm64: [
      '%EXE_DIR%/trishlibrary',
      '/Applications/TrishLibrary.app',
      '~/Applications/TrishLibrary.app',
    ],
    linux_x64: [
      '%EXE_DIR%/trishlibrary',
      '~/.local/share/applications/vn.trishteam.trishlibrary.desktop',
      '/usr/share/applications/vn.trishteam.trishlibrary.desktop',
      '/usr/bin/trishlibrary',
    ],
  },
  trishsearch: {
    windows_x64: [
      '%EXE_DIR%\\trishsearch.exe',
      '%LOCALAPPDATA%\\Programs\\TrishSearch\\TrishSearch.exe',
      '%PROGRAMFILES%\\TrishSearch\\TrishSearch.exe',
    ],
    windows_arm64: [
      '%EXE_DIR%\\trishsearch.exe',
      '%LOCALAPPDATA%\\Programs\\TrishSearch\\TrishSearch.exe',
      '%PROGRAMFILES%\\TrishSearch\\TrishSearch.exe',
    ],
    macos_x64: [
      '%EXE_DIR%/trishsearch',
      '/Applications/TrishSearch.app',
      '~/Applications/TrishSearch.app',
    ],
    macos_arm64: [
      '%EXE_DIR%/trishsearch',
      '/Applications/TrishSearch.app',
      '~/Applications/TrishSearch.app',
    ],
    linux_x64: [
      '%EXE_DIR%/trishsearch',
      '~/.local/share/applications/vn.trishteam.trishsearch.desktop',
      '/usr/share/applications/vn.trishteam.trishsearch.desktop',
      '/usr/bin/trishsearch',
    ],
  },
  trishdesign: {
    windows_x64: [
      '%EXE_DIR%\\trishdesign.exe',
      '%LOCALAPPDATA%\\Programs\\TrishDesign\\TrishDesign.exe',
      '%PROGRAMFILES%\\TrishDesign\\TrishDesign.exe',
    ],
    windows_arm64: [
      '%EXE_DIR%\\trishdesign.exe',
      '%LOCALAPPDATA%\\Programs\\TrishDesign\\TrishDesign.exe',
      '%PROGRAMFILES%\\TrishDesign\\TrishDesign.exe',
    ],
    macos_x64: [
      '%EXE_DIR%/trishdesign',
      '/Applications/TrishDesign.app',
      '~/Applications/TrishDesign.app',
    ],
    macos_arm64: [
      '%EXE_DIR%/trishdesign',
      '/Applications/TrishDesign.app',
      '~/Applications/TrishDesign.app',
    ],
    linux_x64: [
      '%EXE_DIR%/trishdesign',
      '~/.local/share/applications/vn.trishteam.trishdesign.desktop',
      '/usr/share/applications/vn.trishteam.trishdesign.desktop',
      '/usr/bin/trishdesign',
    ],
  },
};
