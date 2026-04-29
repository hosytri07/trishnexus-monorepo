/**
 * Seed registry cho launcher — fallback offline.
 *
 * Production: launcher fetch `https://www.trishteam.io.vn/apps-registry.json`
 * (canonical URL — apex redirect 307 nên dùng www). Seed này chỉ chạy khi
 * fetch fail (offline lần đầu, DNS down, etc).
 *
 * Shape là `AppRegistry` của @trishteam/core — không duplicate type.
 *
 * Phase 20.2 (2026-04-29) — Sync với `website/public/apps-registry.json`
 * schema_version 3:
 *   - 10 app v1.0.0 scheduled 2026-05-04T09:00+07
 *   - 6 app active: trishlauncher / trishfont / trishclean / trishcheck /
 *     trishlibrary / trishdesign
 *   - 4 app deprecated (đã gộp vào TrishLibrary): trishnote / trishimage /
 *     trishsearch / trishtype
 *   - TrishAdmin KHÔNG có trong launcher (admin tool nội bộ — tải qua GitHub)
 *
 * Khi update registry online, file này nên được update theo (manual sync).
 */
import type { AppRegistry } from '@trishteam/core/apps';

const RELEASE_AT_DEFAULT = '2026-05-04T09:00:00+07:00';

export const SEED_REGISTRY: AppRegistry = {
  schema_version: 3,
  updated_at: '2026-04-29T00:00+07:00',
  ecosystem: {
    name: 'TrishTEAM',
    tagline: 'Hệ sinh thái năng suất cá nhân',
    logo_url: 'https://trishteam.io.vn/logo.svg',
    website: 'https://trishteam.io.vn',
  },
  release_at_default: RELEASE_AT_DEFAULT,
  apps: [
    {
      id: 'trishlauncher',
      name: 'TrishLauncher',
      tagline:
        'Hub trung tâm — cài đặt + cập nhật + chạy 9 app TrishTEAM trong 1 nơi',
      logo_url: 'https://trishteam.io.vn/logos/trishlauncher.png',
      version: '1.0.0',
      size_bytes: 0,
      status: 'scheduled',
      release_at: RELEASE_AT_DEFAULT,
      login_required: 'none',
      platforms: ['windows_x64'],
      screenshots: [],
      changelog_url:
        'https://github.com/hosytri07/trishnexus-monorepo/releases/tag/trishlauncher-v1.0.0',
      download: {
        windows_x64: {
          url: 'https://github.com/hosytri07/trishnexus-monorepo/releases/download/trishlauncher-v1.0.0/TrishLauncher_1.0.0_x64-setup.exe',
          sha256: '',
          installer_args: [],
        },
      },
    },
    {
      id: 'trishfont',
      name: 'TrishFont',
      tagline:
        'Quản lý font tiếng Việt + AutoCAD .shx + Pair AI gợi ý font đôi',
      logo_url: 'https://trishteam.io.vn/logos/trishfont.png',
      version: '1.0.0',
      size_bytes: 0,
      status: 'scheduled',
      release_at: RELEASE_AT_DEFAULT,
      login_required: 'none',
      platforms: ['windows_x64'],
      screenshots: [],
      changelog_url:
        'https://github.com/hosytri07/trishnexus-monorepo/releases/tag/trishfont-v1.0.0',
      download: {
        windows_x64: {
          url: 'https://github.com/hosytri07/trishnexus-monorepo/releases/download/trishfont-v1.0.0/TrishFont_1.0.0_x64-setup.exe',
          sha256: '',
          installer_args: [],
        },
      },
    },
    {
      id: 'trishclean',
      name: 'TrishClean',
      tagline: 'Dọn file/cache an toàn — staged delete + undo 7 ngày',
      logo_url: 'https://trishteam.io.vn/logos/trishclean.png',
      version: '1.0.0',
      size_bytes: 0,
      status: 'scheduled',
      release_at: RELEASE_AT_DEFAULT,
      login_required: 'none',
      platforms: ['windows_x64'],
      screenshots: [],
      changelog_url:
        'https://github.com/hosytri07/trishnexus-monorepo/releases/tag/trishclean-v1.0.0',
      download: {
        windows_x64: {
          url: 'https://github.com/hosytri07/trishnexus-monorepo/releases/download/trishclean-v1.0.0/TrishClean_1.0.0_x64-setup.exe',
          sha256: '',
          installer_args: [],
        },
      },
    },
    {
      id: 'trishcheck',
      name: 'TrishCheck',
      tagline:
        'Kiểm tra hệ thống + benchmark CPU/RAM/disk + so sánh với 25 app phổ biến',
      logo_url: 'https://trishteam.io.vn/logos/trishcheck.png',
      version: '1.0.0',
      size_bytes: 0,
      status: 'scheduled',
      release_at: RELEASE_AT_DEFAULT,
      login_required: 'none',
      platforms: ['windows_x64'],
      screenshots: [],
      changelog_url:
        'https://github.com/hosytri07/trishnexus-monorepo/releases/tag/trishcheck-v1.0.0',
      download: {
        windows_x64: {
          url: 'https://github.com/hosytri07/trishnexus-monorepo/releases/download/trishcheck-v1.0.0/TrishCheck_1.0.0_x64-setup.exe',
          sha256: '',
          installer_args: [],
        },
      },
    },
    {
      id: 'trishlibrary',
      name: 'TrishLibrary',
      tagline:
        'All-in-one: 📚 Thư viện · 📝 Ghi chú · 📄 Tài liệu · 🖼 Ảnh (PDF Tools + chuyển đổi đa định dạng)',
      logo_url: 'https://trishteam.io.vn/logos/trishlibrary.png',
      version: '1.0.0',
      size_bytes: 0,
      status: 'scheduled',
      release_at: RELEASE_AT_DEFAULT,
      login_required: 'trial',
      platforms: ['windows_x64'],
      screenshots: [],
      changelog_url:
        'https://github.com/hosytri07/trishnexus-monorepo/releases/tag/trishlibrary-v1.0.0',
      download: {
        windows_x64: {
          url: 'https://github.com/hosytri07/trishnexus-monorepo/releases/download/trishlibrary-v1.0.0/TrishLibrary_1.0.0_x64-setup.exe',
          sha256: '',
          installer_args: [],
        },
      },
    },
    {
      id: 'trishdesign',
      name: 'TrishDesign',
      tagline: 'Bộ công cụ thiết kế hạ tầng giao thông cho kỹ sư XD-GT',
      logo_url: 'https://trishteam.io.vn/logos/trishdesign.png',
      version: '1.0.0',
      size_bytes: 0,
      status: 'scheduled',
      release_at: RELEASE_AT_DEFAULT,
      login_required: 'user',
      platforms: ['windows_x64'],
      screenshots: [],
      changelog_url:
        'https://github.com/hosytri07/trishnexus-monorepo/releases/tag/trishdesign-v1.0.0',
      download: {
        windows_x64: {
          url: 'https://github.com/hosytri07/trishnexus-monorepo/releases/download/trishdesign-v1.0.0/TrishDesign_1.0.0_x64-setup.exe',
          sha256: '',
          installer_args: [],
        },
      },
    },
    // ===== 4 app DEPRECATED (đã gộp vào TrishLibrary 1.0) =====
    {
      id: 'trishnote',
      name: 'TrishNote',
      tagline:
        '👉 Đã tích hợp vào TrishLibrary 1.0 (module Ghi chú). Tải TrishLibrary để dùng.',
      logo_url: 'https://trishteam.io.vn/logos/trishnote.png',
      version: '1.0.0',
      size_bytes: 0,
      status: 'deprecated',
      login_required: 'none',
      platforms: ['windows_x64'],
      screenshots: [],
      changelog_url: '',
      download: { windows_x64: { url: '', sha256: '', installer_args: [] } },
    },
    {
      id: 'trishimage',
      name: 'TrishImage',
      tagline:
        '👉 Đã tích hợp vào TrishLibrary 1.0 (module Ảnh). Tải TrishLibrary để dùng.',
      logo_url: 'https://trishteam.io.vn/logos/trishimage.png',
      version: '1.0.0',
      size_bytes: 0,
      status: 'deprecated',
      login_required: 'none',
      platforms: ['windows_x64'],
      screenshots: [],
      changelog_url: '',
      download: { windows_x64: { url: '', sha256: '', installer_args: [] } },
    },
    {
      id: 'trishsearch',
      name: 'TrishSearch',
      tagline:
        '👉 Đã tích hợp vào TrishLibrary 1.0 (Search built-in). Tải TrishLibrary để dùng.',
      logo_url: 'https://trishteam.io.vn/logos/trishsearch.png',
      version: '1.0.0',
      size_bytes: 0,
      status: 'deprecated',
      login_required: 'none',
      platforms: ['windows_x64'],
      screenshots: [],
      changelog_url: '',
      download: { windows_x64: { url: '', sha256: '', installer_args: [] } },
    },
    {
      id: 'trishtype',
      name: 'TrishType',
      tagline:
        '👉 Đã tích hợp vào TrishLibrary 1.0 (module Tài liệu). Tải TrishLibrary để dùng.',
      logo_url: 'https://trishteam.io.vn/logos/trishtype.png',
      version: '1.0.0',
      size_bytes: 0,
      status: 'deprecated',
      login_required: 'none',
      platforms: ['windows_x64'],
      screenshots: [],
      changelog_url: '',
      download: { windows_x64: { url: '', sha256: '', installer_args: [] } },
    },
  ],
};
