/**
 * Seed registry cho launcher alpha.1.
 *
 * Ở Phase 14.2.x, launcher sẽ fetch registry thật từ
 * `https://trishteam.io.vn/apps-registry.json` (hoặc Firestore nếu user
 * đã login). Giữ inline seed này làm fallback offline + giúp UI render
 * được ngay trong `pnpm dev`.
 *
 * Shape là `AppRegistry` của @trishteam/core — không duplicate type.
 *
 * Cập nhật 14.5.5.a (2026-04-24): đủ 9 app còn lại (không bao gồm
 * trishlauncher — launcher không show chính nó trong grid).
 */
import type { AppRegistry } from '@trishteam/core/apps';

export const SEED_REGISTRY: AppRegistry = {
  schema_version: 2,
  updated_at: '2026-04-24',
  ecosystem: {
    name: 'TrishTEAM',
    tagline: 'Hệ sinh thái năng suất cá nhân',
    logo_url: 'https://trishteam.io.vn/logo.svg',
    website: 'https://trishteam.io.vn',
  },
  apps: [
    {
      id: 'trishfont',
      name: 'TrishFont',
      tagline: 'Quản lý font tiếng Việt chuyên nghiệp',
      logo_url: 'https://trishteam.io.vn/logos/trishfont.png',
      version: '2.0.0',
      size_bytes: 38_000_000,
      status: 'coming_soon',
      login_required: 'none',
      platforms: ['windows_x64', 'macos_arm64'],
      screenshots: [],
      changelog_url: 'https://trishteam.io.vn/apps/trishfont/changelog',
      download: {
        windows_x64: {
          url: 'https://trishteam.io.vn/dl/trishfont-2.0.0-x64.msi',
          sha256: '',
          installer_args: ['/quiet'],
        },
      },
    },
    {
      id: 'trishnote',
      name: 'TrishNote',
      tagline: 'Ghi chú + daily review + kanban',
      logo_url: 'https://trishteam.io.vn/logos/trishnote.png',
      version: '2.0.0',
      size_bytes: 45_000_000,
      status: 'coming_soon',
      login_required: 'none',
      platforms: ['windows_x64', 'macos_arm64', 'linux_x64'],
      screenshots: [],
      changelog_url: 'https://trishteam.io.vn/apps/trishnote/changelog',
      download: {
        windows_x64: {
          url: 'https://trishteam.io.vn/dl/trishnote-2.0.0-x64.msi',
          sha256: '',
          installer_args: ['/quiet'],
        },
      },
    },
    {
      id: 'trishclean',
      name: 'TrishClean',
      tagline: 'Dọn file/cache với undo 7 ngày',
      logo_url: 'https://trishteam.io.vn/logos/trishclean.png',
      version: '2.0.0',
      size_bytes: 28_000_000,
      status: 'coming_soon',
      login_required: 'none',
      platforms: ['windows_x64'],
      screenshots: [],
      changelog_url: '',
      download: {
        windows_x64: {
          url: 'https://trishteam.io.vn/dl/trishclean-2.0.0-x64.msi',
          sha256: '',
          installer_args: ['/quiet'],
        },
      },
    },
    {
      id: 'trishcheck',
      name: 'TrishCheck',
      tagline: 'System info + benchmark máy',
      logo_url: 'https://trishteam.io.vn/logos/trishcheck.png',
      version: '2.0.0-1',
      size_bytes: 10_485_760,
      status: 'released',
      login_required: 'none',
      platforms: ['windows_x64'],
      screenshots: [],
      changelog_url:
        'https://github.com/hosytri07/trishnexus-monorepo/releases/tag/trishcheck-v2.0.0-1',
      download: {
        windows_x64: {
          url: 'https://github.com/hosytri07/trishnexus-monorepo/releases/download/trishcheck-v2.0.0-1/TrishCheck_2.0.0-1_x64-setup.exe',
          sha256:
            'feaa4334d407634f3bf023f034f0af336d2ad9c8aae117dd82356d8caa3a2be8',
          installer_args: [],
        },
      },
    },
    {
      id: 'trishtype',
      name: 'TrishType',
      tagline: 'Text editor CRDT multi-caret',
      logo_url: 'https://trishteam.io.vn/logos/trishtype.png',
      version: '2.0.0',
      size_bytes: 32_000_000,
      status: 'coming_soon',
      login_required: 'none',
      platforms: ['windows_x64', 'macos_arm64'],
      screenshots: [],
      changelog_url: '',
      download: {
        windows_x64: {
          url: 'https://trishteam.io.vn/dl/trishtype-2.0.0-x64.msi',
          sha256: '',
          installer_args: ['/quiet'],
        },
      },
    },
    {
      id: 'trishimage',
      name: 'TrishImage',
      tagline: 'Tổ chức ảnh + event/face grouping',
      logo_url: 'https://trishteam.io.vn/logos/trishimage.png',
      version: '2.0.0',
      size_bytes: 42_000_000,
      status: 'coming_soon',
      login_required: 'none',
      platforms: ['windows_x64', 'macos_arm64'],
      screenshots: [],
      changelog_url: '',
      download: {
        windows_x64: {
          url: 'https://trishteam.io.vn/dl/trishimage-2.0.0-x64.msi',
          sha256: '',
          installer_args: ['/quiet'],
        },
      },
    },
    {
      id: 'trishlibrary',
      name: 'TrishLibrary',
      tagline: 'Thư viện PDF/epub + cite APA/IEEE',
      logo_url: 'https://trishteam.io.vn/logos/trishlibrary.png',
      version: '2.0.0',
      size_bytes: 52_000_000,
      status: 'coming_soon',
      login_required: 'none',
      platforms: ['windows_x64', 'macos_arm64'],
      screenshots: [],
      changelog_url: '',
      download: {
        windows_x64: {
          url: 'https://trishteam.io.vn/dl/trishlibrary-2.0.0-x64.msi',
          sha256: '',
          installer_args: ['/quiet'],
        },
      },
    },
    {
      id: 'trishsearch',
      name: 'TrishSearch',
      tagline: 'Full-text search BM25 offline',
      logo_url: 'https://trishteam.io.vn/logos/trishsearch.png',
      version: '2.0.0',
      size_bytes: 42_000_000,
      status: 'coming_soon',
      login_required: 'none',
      platforms: ['windows_x64', 'macos_arm64', 'linux_x64'],
      screenshots: [],
      changelog_url: '',
      download: {
        windows_x64: {
          url: 'https://trishteam.io.vn/dl/trishsearch-2.0.0-x64.msi',
          sha256: '',
          installer_args: ['/quiet'],
        },
      },
    },
    {
      id: 'trishdesign',
      name: 'TrishDesign',
      tagline: 'Color palette WCAG + design tokens',
      logo_url: 'https://trishteam.io.vn/logos/trishdesign.png',
      version: '2.0.0',
      size_bytes: 30_000_000,
      status: 'coming_soon',
      login_required: 'none',
      platforms: ['windows_x64', 'macos_arm64'],
      screenshots: [],
      changelog_url: '',
      download: {
        windows_x64: {
          url: 'https://trishteam.io.vn/dl/trishdesign-2.0.0-x64.msi',
          sha256: '',
          installer_args: ['/quiet'],
        },
      },
    },
  ],
};
