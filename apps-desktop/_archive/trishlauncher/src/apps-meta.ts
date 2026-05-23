/**
 * App meta cho launcher — features + accent color cho App Detail Modal.
 *
 * Khác với `website/data/apps-meta.ts` (là marketing copy cho website
 * landing), file này phản ánh ĐÚNG implementation Phase 14.3/14.4 rebuild
 * của từng app — để user click vào app trong launcher đọc thấy khớp với
 * những gì thực sự ship trong binary.
 *
 * Shape là `AppMeta` từ `@trishteam/core/apps` — `mergeRegistry(SEED, META)`
 * sẽ merge vào `AppForUi` cho UI consumption.
 *
 * Phase 14.5.5.b — 2026-04-24.
 */
import type { AppMeta } from '@trishteam/core/apps';

export const APP_META: Record<string, AppMeta> = {
  trishlauncher: {
    release_date: '2026-04-24',
    features: [
      'Single entry point cho toàn bộ 10 app TrishTEAM',
      'Auto detect OS + architecture để filter app tương thích',
      'Mở URL download chính thống qua tauri-plugin-opener (không spoof)',
      'Ecosystem info + system info panel (OS/CPU/RAM/version)',
      'Icon sáng trên nền tối — pattern App Store / Play Store',
    ],
    accent: '#1E3A8A',
    icon_fallback: 'Rocket',
    logo_path: '',
  },
  trishcheck: {
    release_date: '2026-04-24',
    features: [
      'CPU benchmark SHA-256 trên buffer 50 MB → throughput MB/s',
      'Memory bandwidth copy 64 MB source→dest → MB/s',
      'Đọc OS / CPU / RAM / swap / uptime qua sysinfo crate',
      'Scoring 5-tier: excellent / good / ok / low / very_low',
      '100% local — không gửi telemetry, không cần network',
    ],
    accent: '#16A34A',
    icon_fallback: 'Activity',
    logo_path: '',
  },
  trishclean: {
    release_date: '2026-04-24',
    features: [
      'Staged delete + undo 7 ngày — commit sau retention window',
      '9 category ưu tiên: cache / temp / download / recycle / empty / large / old / other',
      'Age bucket 5-tier: recent / month / quarter / year / ancient',
      'Hard cap max_entries 200k + depth 32 (chống pick `/` treo app)',
      'Scan-only mode an toàn, preview trước khi chạy lệnh xoá thật',
    ],
    accent: '#DC2626',
    icon_fallback: 'Trash2',
    logo_path: '',
  },
  trishfont: {
    release_date: '2026-04-24',
    features: [
      'Scan folder đệ quy cấp 8 cho .ttf / .otf / .ttc / .otc',
      'Pair AI: gợi ý cặp heading + body theo score tiếng Việt + personality',
      'Phát hiện font hỗ trợ tiếng Việt (26 diacritic, threshold 80%)',
      '8 nhóm personality: serif / sans / slab / mono / display / script / handwriting / unknown',
      'Preview 3 sample: English pangram + VN diacritic + brand name',
    ],
    accent: '#7C3AED',
    icon_fallback: 'Type',
    logo_path: '',
  },
  trishtype: {
    release_date: '2026-04-24',
    features: [
      'CRDT RGA text merge — 2 actor gõ cùng vị trí vẫn hội tụ cùng kết quả',
      'Multi-caret: gõ đồng thời ở nhiều vị trí trong document',
      'Anchor caret theo char ID, không bị shift khi doc insert/delete',
      'Keyboard shortcut: Ctrl+S / Ctrl+O + ←/→ multi-caret navigate',
      'Serialize v1 JSON roundtrip — lưu nguyên trạng CRDT, không mất ops',
    ],
    accent: '#EC4899',
    icon_fallback: 'FileText',
    logo_path: '',
  },
  trishimage: {
    release_date: '2026-04-24',
    features: [
      'Scan 10 format (jpg / png / webp / heic / tiff / gif / bmp …) đệ quy cấp 8',
      'Parse EXIF DateTimeOriginal + camera Model + GPS qua kamadak-exif',
      'Header probe (≤512 byte) cho width/height — không decode pixel',
      'Event grouping: sort taken_ms + gap split 8h → bucket ngày',
      'Aspect classify: landscape / portrait / square / panorama / unknown',
    ],
    accent: '#DB2777',
    icon_fallback: 'Image',
    logo_path: '',
  },
  trishnote: {
    release_date: '2026-04-24',
    features: [
      'Kanban 4 lane: Inbox / Đang làm / Chờ / Xong (+ Lưu trữ)',
      'Daily review queue: interval 7 ngày + UTC day streak counter',
      'Tag tự do + search substring, soft delete giữ deletedAt field',
      'Atomic write `.json.tmp` → rename — chống corrupt khi crash',
      'Offline-first, local-only v1 (Firestore sync defer 14.4.1.b)',
    ],
    accent: '#2563EB',
    icon_fallback: 'NotebookPen',
    logo_path: '',
  },
  trishlibrary: {
    release_date: '2026-04-24',
    features: [
      '10 format: pdf / docx / doc / epub / txt / md / html / rtf / odt',
      'Tag auto-suggest score: keyword 0.85 + co-occurrence + format fallback',
      'Cite APA 7: "Last, F. M." + "&" join + et al. 8+ + italic title',
      'Cite IEEE: "F. M. Last" + "and" join + [1]..[n] numbered + quoted',
      'Status tracking: unread / reading / done / abandoned',
    ],
    accent: '#0D9488',
    icon_fallback: 'Library',
    logo_path: '',
  },
  trishsearch: {
    release_date: '2026-04-24',
    features: [
      'BM25 ranking k1=1.2 b=0.75 + recency boost HOT 7d / COLD 365d',
      'Query DSL: phrase "quoted" + -negate + *prefix + source:note/library/file',
      'Title×3 + Tag×2 + Body×1 TF weighting gộp sẵn vào index',
      'Tokenize fold diacritic tiếng Việt + lite stem Porter',
      'Snippet ±100 chars quanh match + `<mark>` HTML-escaped highlight',
    ],
    accent: '#EA580C',
    icon_fallback: 'Search',
    logo_path: '',
  },
  trishdesign: {
    release_date: '2026-04-24',
    features: [
      'Generate color scale 50..950 (11 swatch) với lightness curve',
      '6 harmony: monochromatic / complementary / analogous / triadic / split / tetradic',
      'WCAG contrast matrix N×N với rating fail / AA-large / AA / AAA',
      'Export 5 format: CSS vars / Tailwind config / Figma Tokens / SCSS / JSON',
      'Semantic alias `scaleName.key` → hex tự resolve khi export',
    ],
    accent: '#6D28D9',
    icon_fallback: 'Palette',
    logo_path: '',
  },
};
