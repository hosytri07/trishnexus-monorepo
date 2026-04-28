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
  updated_at: '2026-04-26',
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
      tagline: 'Quản lý font tiếng Việt + AutoCAD + Fontpack',
      logo_url: 'https://trishteam.io.vn/logos/trishfont.png',
      version: '2.0.0-1',
      size_bytes: 3_420_160,
      status: 'released',
      login_required: 'none',
      platforms: ['windows_x64'],
      screenshots: [],
      changelog_url:
        'https://github.com/hosytri07/trishnexus-monorepo/releases/tag/trishfont-v2.0.0-1',
      download: {
        windows_x64: {
          url: 'https://github.com/hosytri07/trishnexus-monorepo/releases/download/trishfont-v2.0.0-1/TrishFont_2.0.0-1_x64-setup.exe',
          sha256:
            '1944c3a7c8f584cba0ac9cce9f22326ffc071318f2ebcf5808b6de8c27c830b3',
          installer_args: [],
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
      login_required: 'trial',
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
      tagline: 'Dọn file/cache an toàn — 13+ presets + AutoCAD junk + undo 7 ngày',
      logo_url: 'https://trishteam.io.vn/logos/trishclean.png',
      version: '2.0.0-1',
      size_bytes: 10_485_760,
      status: 'released',
      login_required: 'none',
      platforms: ['windows_x64'],
      screenshots: [],
      changelog_url: 'https://github.com/hosytri07/trishnexus-monorepo/releases/tag/trishclean-v2.0.0-1',
      download: {
        windows_x64: {
          url: 'https://github.com/hosytri07/trishnexus-monorepo/releases/download/trishclean-v2.0.0-1/TrishClean_2.0.0-1_x64-setup.exe',
          sha256: '8e7cc770cf25e4be2f813f15bbd17e528b32fab8a0aa3fdc158089323a388a7c',
          installer_args: [],
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
      login_required: 'trial',
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
      tagline: 'Thư viện PDF/EPUB/Word + Online Library + TrishTEAM curated + QR share',
      logo_url: 'https://trishteam.io.vn/logos/trishlibrary.png',
      version: '2.1.2',
      size_bytes: 10_485_760,
      status: 'released',
      login_required: 'trial',
      platforms: ['windows_x64'],
      screenshots: [],
      changelog_url: 'https://github.com/hosytri07/trishnexus-monorepo/releases/tag/trishlibrary-v2.1.2',
      download: {
        windows_x64: {
          url: 'https://github.com/hosytri07/trishnexus-monorepo/releases/download/trishlibrary-v2.1.2/TrishLibrary_2.1.2_x64-setup.exe',
          sha256: '6b4376550e754b8d2e75d1d8f65c8a3fb63f7fad186d108427eb4c232932f935',
          installer_args: [],
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
      login_required: 'trial',
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
