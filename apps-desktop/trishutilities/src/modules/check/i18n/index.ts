/**
 * Phase 15.0 — TrishCheck i18n.
 *
 * VN default, EN bù sau khi UI stable. Pattern copy từ TrishLauncher.
 * Miss key → fallback VI → literal key (visible "X.Y.Z" = dev bug rõ).
 */

import type { Language } from '../settings.js';

type Dict = Record<string, string>;

const VI: Dict = {
  // Topbar
  'topbar.tagline': 'Kiểm tra cấu hình máy',
  'topbar.settings': 'Cài đặt',

  // Tab navigation
  'tab.system': 'Thông tin máy',
  'tab.minspec': 'So sánh phần mềm',
  'tab.history': 'Lịch sử',

  // Actions toolbar
  'action.refresh': 'Làm mới',
  'action.copy': 'Sao chép',
  'action.copy_done': 'Đã sao chép',
  'action.export_json': 'Xuất JSON',
  'action.export_md': 'Xuất Markdown',
  'action.snapshot': 'Lưu snapshot',
  'action.snapshot_done': 'Đã lưu',
  'action.benchmark': 'Bắt đầu kiểm tra',
  'action.benchmark_running': 'Đang chạy…',
  'action.benchmark_again': 'Chạy lại',

  // System info labels
  'sys.os': 'Hệ điều hành',
  'sys.arch': 'Kiến trúc',
  'sys.hostname': 'Tên máy',
  'sys.uptime': 'Thời gian bật',
  'sys.cpu': 'CPU',
  'sys.cpu_cores': 'Số nhân',
  'sys.cpu_freq': 'Xung nhịp',
  'sys.ram_total': 'RAM tổng',
  'sys.ram_used': 'RAM đang dùng',
  'sys.swap': 'Swap',
  'sys.disks': 'Ổ đĩa',
  'sys.network': 'Mạng',
  'sys.disk_used': 'Đã dùng',
  'sys.disk_free': 'Còn trống',

  // Section headers
  'section.system': 'Thông tin hệ thống',
  'section.cpu_ram': 'CPU & Bộ nhớ',
  'section.gpu': 'Card đồ họa (GPU)',
  'section.disk': 'Ổ đĩa',
  'section.network': 'Mạng',
  'section.battery': 'Pin (laptop)',
  'section.top_processes': 'Top tiến trình tiêu thụ',
  'section.benchmark': 'Benchmark',

  // Battery
  'battery.design': 'Dung lượng gốc',
  'battery.full_charge': 'Sạc đầy hiện tại',
  'battery.health': 'Sức khỏe pin',
  'battery.health_good': 'Pin tốt',
  'battery.health_ok': 'Hơi chai',
  'battery.health_bad': 'Chai nhiều — nên thay',

  // Top processes
  'top_proc.by_memory': 'Top tiêu thụ RAM',
  'top_proc.by_cpu': 'Top tiêu thụ CPU',

  // Benchmark
  'bench.cpu': 'CPU (SHA-256, đa luồng)',
  'bench.memory': 'Băng thông bộ nhớ',
  'bench.disk': 'Tốc độ ổ đĩa',
  'bench.empty': 'Chưa có dữ liệu — bấm "Bắt đầu kiểm tra"',
  'bench.unit': 'MB/s',
  'bench.note':
    'Bench CPU đa luồng + memory bandwidth + disk read/write. Mất ~5-15 giây. Kết quả không gửi về server.',

  // Min-spec compare
  'minspec.title': 'Máy bạn có chạy được phần mềm phổ biến?',
  'minspec.subtitle':
    'So sánh cấu hình hiện tại với spec đề xuất của các app phổ biến.',
  'minspec.col_app': 'Phần mềm',
  'minspec.col_min': 'Tối thiểu',
  'minspec.col_recommended': 'Đề xuất',
  'minspec.col_status': 'Máy bạn',
  'minspec.status_pass': 'Chạy mượt',
  'minspec.status_warn': 'Chạy được — vừa đủ',
  'minspec.status_fail': 'Không đủ',

  // History
  'history.title': 'Lịch sử kiểm tra',
  'history.subtitle': 'Các snapshot đã lưu (tối đa 30 mục, FIFO).',
  'history.empty': 'Chưa có snapshot nào.',
  'history.delete': 'Xóa',
  'history.delete_all': 'Xóa tất cả',
  'history.confirm_delete_all': 'Xóa toàn bộ lịch sử?',
  'history.taken_at': 'Lưu lúc',

  // Settings modal
  'settings.title': 'Cài đặt',
  'settings.close': 'Đóng',
  'settings.save': 'Lưu',
  'settings.cancel': 'Hủy',
  'settings.theme.label': 'Giao diện',
  'settings.theme.light': 'Sáng',
  'settings.theme.dark': 'Tối',
  'settings.theme.system': 'Theo hệ thống',
  'settings.language.label': 'Ngôn ngữ',
  'settings.language.vi': 'Tiếng Việt',
  'settings.language.en': 'English',
  'settings.snapshot.label': 'Tự lưu snapshot khi benchmark xong',
  'settings.snapshot.hint':
    'Khi bật, mỗi lần bench xong sẽ tự thêm 1 entry vào Lịch sử.',

  // Footer
  'footer.copyright': '© 2026 TrishTEAM',
};

const EN: Dict = {
  'topbar.tagline': 'Check your machine specs',
  'topbar.settings': 'Settings',

  'tab.system': 'System Info',
  'tab.minspec': 'Software Compare',
  'tab.history': 'History',

  'action.refresh': 'Refresh',
  'action.copy': 'Copy',
  'action.copy_done': 'Copied',
  'action.export_json': 'Export JSON',
  'action.export_md': 'Export Markdown',
  'action.snapshot': 'Save snapshot',
  'action.snapshot_done': 'Saved',
  'action.benchmark': 'Start benchmark',
  'action.benchmark_running': 'Running…',
  'action.benchmark_again': 'Run again',

  'sys.os': 'Operating system',
  'sys.arch': 'Architecture',
  'sys.hostname': 'Hostname',
  'sys.uptime': 'Uptime',
  'sys.cpu': 'CPU',
  'sys.cpu_cores': 'Cores',
  'sys.cpu_freq': 'Frequency',
  'sys.ram_total': 'Total RAM',
  'sys.ram_used': 'Used RAM',
  'sys.swap': 'Swap',
  'sys.disks': 'Disks',
  'sys.network': 'Network',
  'sys.disk_used': 'Used',
  'sys.disk_free': 'Free',

  'section.system': 'System information',
  'section.cpu_ram': 'CPU & Memory',
  'section.gpu': 'Graphics card (GPU)',
  'section.disk': 'Disks',
  'section.network': 'Network',
  'section.battery': 'Battery (laptop)',
  'section.top_processes': 'Top resource consumers',
  'section.benchmark': 'Benchmark',

  'battery.design': 'Design capacity',
  'battery.full_charge': 'Full charge now',
  'battery.health': 'Battery health',
  'battery.health_good': 'Good',
  'battery.health_ok': 'Slightly worn',
  'battery.health_bad': 'Worn — consider replacing',

  'top_proc.by_memory': 'Top RAM consumers',
  'top_proc.by_cpu': 'Top CPU consumers',

  'bench.cpu': 'CPU (SHA-256, multi-thread)',
  'bench.memory': 'Memory bandwidth',
  'bench.disk': 'Disk speed',
  'bench.empty': 'No data — click "Start benchmark"',
  'bench.unit': 'MB/s',
  'bench.note':
    'CPU multi-thread + memory bandwidth + disk read/write. Takes ~5-15 seconds. Results stay local.',

  'minspec.title': 'Can your machine run popular software?',
  'minspec.subtitle':
    'Compare current specs with recommended specs of popular apps.',
  'minspec.col_app': 'Software',
  'minspec.col_min': 'Minimum',
  'minspec.col_recommended': 'Recommended',
  'minspec.col_status': 'Your machine',
  'minspec.status_pass': 'Smooth',
  'minspec.status_warn': 'Just enough',
  'minspec.status_fail': 'Insufficient',

  'history.title': 'Check history',
  'history.subtitle': 'Saved snapshots (max 30, FIFO).',
  'history.empty': 'No snapshots yet.',
  'history.delete': 'Delete',
  'history.delete_all': 'Delete all',
  'history.confirm_delete_all': 'Delete all history?',
  'history.taken_at': 'Taken at',

  'settings.title': 'Settings',
  'settings.close': 'Close',
  'settings.save': 'Save',
  'settings.cancel': 'Cancel',
  'settings.theme.label': 'Theme',
  'settings.theme.light': 'Light',
  'settings.theme.dark': 'Dark',
  'settings.theme.system': 'System',
  'settings.language.label': 'Language',
  'settings.language.vi': 'Tiếng Việt',
  'settings.language.en': 'English',
  'settings.snapshot.label': 'Auto-save snapshot after benchmark',
  'settings.snapshot.hint':
    'When on, each benchmark adds 1 entry to history.',

  'footer.copyright': '© 2026 TrishTEAM',
};

const DICTS: Record<Language, Dict> = { vi: VI, en: EN };

export function t(key: string, lang: Language): string {
  return DICTS[lang]?.[key] ?? VI[key] ?? key;
}

export function makeT(lang: Language): (key: string) => string {
  return (key) => t(key, lang);
}
