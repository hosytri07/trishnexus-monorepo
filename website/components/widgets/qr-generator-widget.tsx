'use client';

/**
 * QrGeneratorWidget — Phase 11.5.24e.
 *
 * Thay đổi so với 11.5.23:
 *   • Bundle qrcode@1.5.3 NPM LOCAL — không còn phụ thuộc CDN cdnjs/jsdelivr/
 *     unpkg (user report CDN fail khi dev offline/ad-block). Import trực tiếp
 *     → load tức thì, không spinner, không fallback chain.
 *   • Giữ nguyên layout 4 section, metadata Title + Note, save to localStorage.
 *
 * Chỉ lưu link + tên ghi chú + mô tả (không lưu ảnh) — nhẹ localStorage.
 * Sau Phase 11.7 sẽ sync Firestore cùng collection với TrishNote.
 */
import QRCode from 'qrcode';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from 'react';
import {
  QrCode,
  ClipboardPaste,
  X,
  Download,
  Copy,
  Check,
  ExternalLink,
  Share2,
  Send,
  Facebook,
  Mail,
  Image as ImageIcon,
  FileCode2,
  Sparkles,
  Save,
  BookmarkPlus,
  Trash2,
  RotateCcw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { WidgetCard } from './widget-card';

// -------------------------------------------------------------------------
// Types
// -------------------------------------------------------------------------
type EccLevel = 'L' | 'M' | 'Q' | 'H';

type QRCodeToCanvasOptions = {
  errorCorrectionLevel?: EccLevel;
  margin?: number;
  width?: number;
  color?: { dark?: string; light?: string };
};

type QRCodeToStringOptions = QRCodeToCanvasOptions & {
  type?: 'svg' | 'utf8' | 'terminal';
};

type SavedEntry = {
  id: string;
  title: string;
  originalUrl: string;
  convertedUrl: string;
  note: string;
  savedAt: number; // epoch ms
};

// -------------------------------------------------------------------------
// Link detection + conversion
// -------------------------------------------------------------------------
type LinkKind =
  | 'drive-file'
  | 'drive-folder'
  | 'docs'
  | 'sheets'
  | 'slides'
  | 'dropbox'
  | 'youtube'
  | 'url'
  | 'text'
  | 'empty';

type Detected = {
  kind: LinkKind;
  label: string;
  converted: string;
  note?: string;
};

const DRIVE_FILE_RE = /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]{10,})/;
const DRIVE_OPEN_RE = /drive\.google\.com\/open\?id=([a-zA-Z0-9_-]{10,})/;
const DRIVE_FOLDER_RE =
  /drive\.google\.com\/drive\/folders\/([a-zA-Z0-9_-]{10,})/;
const DOCS_RE = /docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]{10,})/;
const SHEETS_RE = /docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]{10,})/;
const SLIDES_RE = /docs\.google\.com\/presentation\/d\/([a-zA-Z0-9_-]{10,})/;
const DROPBOX_RE = /dropbox\.com\/(s|scl)\//i;
const YT_FULL_RE = /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/;
const YT_SHORT_RE = /youtu\.be\/([a-zA-Z0-9_-]{11})/;
const URL_RE = /^https?:\/\//i;

function convertLink(raw: string): Detected {
  const s = raw.trim();
  if (!s) return { kind: 'empty', label: 'Trống', converted: '' };

  let m: RegExpMatchArray | null;

  m = s.match(DRIVE_FILE_RE) || s.match(DRIVE_OPEN_RE);
  if (m) {
    return {
      kind: 'drive-file',
      label: 'Google Drive file · Direct download',
      converted: `https://drive.google.com/uc?export=download&id=${m[1]}`,
      note: 'Quét QR → tải file Drive trực tiếp.',
    };
  }

  m = s.match(DRIVE_FOLDER_RE);
  if (m) {
    return {
      kind: 'drive-folder',
      label: 'Google Drive folder',
      converted: s,
      note: 'Folder — quét QR mở trang folder Drive.',
    };
  }

  m = s.match(DOCS_RE);
  if (m) {
    return {
      kind: 'docs',
      label: 'Google Docs · Export PDF',
      converted: `https://docs.google.com/document/d/${m[1]}/export?format=pdf`,
      note: 'Quét QR → tải file Docs dạng PDF.',
    };
  }

  m = s.match(SHEETS_RE);
  if (m) {
    return {
      kind: 'sheets',
      label: 'Google Sheets · Export XLSX',
      converted: `https://docs.google.com/spreadsheets/d/${m[1]}/export?format=xlsx`,
      note: 'Quét QR → tải file Sheets dạng Excel.',
    };
  }

  m = s.match(SLIDES_RE);
  if (m) {
    return {
      kind: 'slides',
      label: 'Google Slides · Export PPTX',
      converted: `https://docs.google.com/presentation/d/${m[1]}/export?format=pptx`,
      note: 'Quét QR → tải file Slides dạng PowerPoint.',
    };
  }

  if (DROPBOX_RE.test(s)) {
    try {
      const u = new URL(s);
      u.searchParams.set('dl', '1');
      return {
        kind: 'dropbox',
        label: 'Dropbox · Direct download',
        converted: u.toString(),
        note: 'Tự set dl=1 để tải trực tiếp.',
      };
    } catch {
      /* noop */
    }
  }

  m = s.match(YT_FULL_RE);
  if (m) {
    return {
      kind: 'youtube',
      label: 'YouTube · Short URL',
      converted: `https://youtu.be/${m[1]}`,
      note: 'Rút gọn thành youtu.be/<id> để QR nhỏ gọn hơn.',
    };
  }
  if (YT_SHORT_RE.test(s)) {
    return { kind: 'youtube', label: 'YouTube · Short URL', converted: s };
  }
  if (URL_RE.test(s)) {
    return { kind: 'url', label: 'URL thường', converted: s };
  }
  return {
    kind: 'text',
    label: 'Văn bản · không phải URL',
    converted: s,
    note: 'Không phải link — QR chứa chuỗi ký tự.',
  };
}

// -------------------------------------------------------------------------
// Local storage cho saved links
// -------------------------------------------------------------------------
const SAVED_KEY = 'trishteam:qr-saved-links';
const SAVED_MAX = 50;

function loadSaved(): SavedEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(SAVED_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (x): x is SavedEntry =>
        x &&
        typeof x.id === 'string' &&
        typeof x.title === 'string' &&
        typeof x.originalUrl === 'string' &&
        typeof x.convertedUrl === 'string',
    );
  } catch {
    return [];
  }
}

function saveSaved(list: SavedEntry[]): void {
  try {
    window.localStorage.setItem(SAVED_KEY, JSON.stringify(list.slice(0, SAVED_MAX)));
  } catch {
    /* noop */
  }
}

function formatSavedAt(ts: number): string {
  const diff = (Date.now() - ts) / 1000;
  if (diff < 60) return 'vừa xong';
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
  const d = new Date(ts);
  return d.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
  });
}

// -------------------------------------------------------------------------
// Samples
// -------------------------------------------------------------------------
const SAMPLES = [
  {
    label: 'Drive file',
    url: 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/view',
  },
  {
    label: 'Docs',
    url: 'https://docs.google.com/document/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/edit',
  },
  {
    label: 'Sheets',
    url: 'https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/edit',
  },
  {
    label: 'YouTube',
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  },
  { label: 'Website', url: 'https://trishteam.vn' },
];

const SIZE_OPTIONS = [192, 256, 384] as const;
type SizeOpt = (typeof SIZE_OPTIONS)[number];

// -------------------------------------------------------------------------
// Widget
// -------------------------------------------------------------------------
export function QrGeneratorWidget() {
  const [value, setValue] = useState<string>(
    'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/view',
  );
  const [title, setTitle] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [size, setSize] = useState<SizeOpt>(256);
  const [ecc, setEcc] = useState<EccLevel>('H');
  const [color, setColor] = useState<string>('#10B981');

  const [renderErr, setRenderErr] = useState<string | null>(null);

  const [copyLinkDone, setCopyLinkDone] = useState(false);
  const [copyImgDone, setCopyImgDone] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [saved, setSaved] = useState<SavedEntry[]>([]);
  const [showSaved, setShowSaved] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const detected = useMemo(() => convertLink(value), [value]);
  const hasValue = Boolean(detected.converted);
  const canOpen = URL_RE.test(detected.converted);

  // --- Hydrate saved list on mount (qrcode lib bundled locally)
  useEffect(() => {
    setSaved(loadSaved());
  }, []);

  // --- Render QR debounced
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const text = detected.converted || ' ';
      QRCode.toCanvas(canvas, text, {
        errorCorrectionLevel: ecc,
        margin: 2,
        width: size,
        color: { dark: color, light: '#ffffff' },
      })
        .then(() => setRenderErr(null))
        .catch((e: unknown) => {
          setRenderErr(e instanceof Error ? e.message : String(e));
        });
    }, 180);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [detected.converted, size, ecc, color]);

  // --- Actions -----------------------------------------------------------
  const handlePaste = useCallback(async () => {
    try {
      const t = await navigator.clipboard.readText();
      if (t) setValue(t);
    } catch {
      /* noop */
    }
  }, []);

  const handleClear = useCallback(() => {
    setValue('');
    setTitle('');
    setNote('');
  }, []);

  const handleDownloadPNG = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const a = document.createElement('a');
    a.href = c.toDataURL('image/png');
    a.download = `trishteam-qr-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, []);

  const handleDownloadSVG = useCallback(async () => {
    try {
      const svg = await QRCode.toString(detected.converted || ' ', {
        type: 'svg',
        errorCorrectionLevel: ecc,
        margin: 2,
        color: { dark: color, light: '#ffffff' },
      });
      const blob = new Blob([svg], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `trishteam-qr-${Date.now()}.svg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setRenderErr(e instanceof Error ? e.message : String(e));
    }
  }, [detected.converted, ecc, color]);

  const handleCopyImage = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    c.toBlob(async (blob) => {
      if (!blob) return;
      try {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore ClipboardItem có trong modern browsers
        await navigator.clipboard.write([
          // @ts-ignore
          new ClipboardItem({ 'image/png': blob }),
        ]);
        setCopyImgDone(true);
        setTimeout(() => setCopyImgDone(false), 1800);
      } catch {
        /* noop */
      }
    }, 'image/png');
  }, []);

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(detected.converted);
      setCopyLinkDone(true);
      setTimeout(() => setCopyLinkDone(false), 1800);
    } catch {
      /* noop */
    }
  }, [detected.converted]);

  const handleOpen = useCallback(() => {
    if (canOpen)
      window.open(detected.converted, '_blank', 'noopener,noreferrer');
  }, [canOpen, detected.converted]);

  // --- Save / load / delete saved entries --------------------------------
  const handleSaveToNotes = useCallback(() => {
    if (!hasValue) return;
    const fallbackTitle = (() => {
      switch (detected.kind) {
        case 'drive-file':
          return 'Drive file';
        case 'drive-folder':
          return 'Drive folder';
        case 'docs':
          return 'Google Docs';
        case 'sheets':
          return 'Google Sheets';
        case 'slides':
          return 'Google Slides';
        case 'dropbox':
          return 'Dropbox';
        case 'youtube':
          return 'YouTube';
        case 'url':
          return detected.converted.replace(/^https?:\/\//, '').split('/')[0];
        default:
          return 'Ghi chú link';
      }
    })();
    const entry: SavedEntry = {
      id:
        Date.now().toString(36) +
        Math.random().toString(36).slice(2, 8),
      title: title.trim() || fallbackTitle,
      originalUrl: value.trim(),
      convertedUrl: detected.converted,
      note: note.trim(),
      savedAt: Date.now(),
    };
    const next = [entry, ...saved].slice(0, SAVED_MAX);
    setSaved(next);
    saveSaved(next);
    setSavedOk(true);
    setShowSaved(true);
    setTimeout(() => setSavedOk(false), 1800);
  }, [hasValue, detected, title, value, note, saved]);

  const handleLoadSaved = useCallback((e: SavedEntry) => {
    setValue(e.originalUrl || e.convertedUrl);
    setTitle(e.title);
    setNote(e.note);
  }, []);

  const handleDeleteSaved = useCallback(
    (id: string) => {
      const next = saved.filter((x) => x.id !== id);
      setSaved(next);
      saveSaved(next);
    },
    [saved],
  );

  const handleClearAllSaved = useCallback(() => {
    if (
      !window.confirm(
        `Xoá hết ${saved.length} link đã lưu? Hành động này không hoàn tác được.`,
      )
    )
      return;
    setSaved([]);
    saveSaved([]);
  }, [saved.length]);

  // --- Share URLs --------------------------------------------------------
  const shareURLs = useMemo(() => {
    const enc = encodeURIComponent(detected.converted);
    const text = encodeURIComponent(
      detected.kind === 'text'
        ? detected.converted
        : `Mình chia sẻ link này: ${detected.converted}`,
    );
    return {
      zalo: `https://sp.zalo.me/share_inapp?url=${enc}`,
      telegram: `https://t.me/share/url?url=${enc}&text=${text}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${enc}`,
      email: `mailto:?subject=${encodeURIComponent(
        'Chia sẻ từ TrishTEAM',
      )}&body=${text}`,
    };
  }, [detected.converted, detected.kind]);

  // ==========================================================================
  // Render
  // ==========================================================================
  return (
    <WidgetCard
      title="QR Code Generator"
      icon={<QrCode size={16} strokeWidth={2} />}
      action={
        <span
          className="text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1"
          style={{
            color: 'var(--color-accent-primary)',
            background: 'var(--color-accent-soft)',
            border: '1px solid var(--color-border-subtle)',
            letterSpacing: '0.05em',
          }}
        >
          <Sparkles size={10} />
          Auto-convert
        </span>
      }
    >
      <div className="flex flex-col gap-6">
        {/* ================ SECTION 1 — Input ================ */}
        <section className="flex flex-col gap-2">
          <label
            htmlFor="tt-qr-input"
            className="text-[11px] uppercase tracking-wide font-medium"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Dán link / nội dung
          </label>
          <div className="flex items-stretch gap-2">
            <input
              id="tt-qr-input"
              type="text"
              value={value}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setValue(e.target.value)
              }
              placeholder="https://... hoặc nội dung bất kỳ"
              className="flex-1 h-10 px-3 text-sm rounded-lg outline-none transition-all"
              style={{
                background: 'var(--color-surface-muted)',
                border: '1px solid var(--color-border-default)',
                color: 'var(--color-text-primary)',
              }}
            />
            <button
              type="button"
              onClick={handlePaste}
              title="Dán từ clipboard"
              className="h-10 px-3 rounded-lg inline-flex items-center gap-1.5 text-xs font-semibold transition-all hover:-translate-y-0.5"
              style={{
                background: 'var(--color-surface-muted)',
                border: '1px solid var(--color-border-default)',
                color: 'var(--color-text-primary)',
              }}
            >
              <ClipboardPaste size={14} strokeWidth={2.25} />
              Dán
            </button>
            <button
              type="button"
              onClick={handleClear}
              title="Xoá sạch các ô nhập"
              className="h-10 w-10 rounded-lg inline-flex items-center justify-center transition-all hover:-translate-y-0.5"
              style={{
                background: 'var(--color-surface-muted)',
                border: '1px solid var(--color-border-default)',
                color: 'var(--color-text-muted)',
              }}
              aria-label="Xoá"
            >
              <X size={14} strokeWidth={2.25} />
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5 items-center">
            <span
              className="text-[10px] uppercase tracking-wide"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Mẫu:
            </span>
            {SAMPLES.map((sm) => (
              <button
                key={sm.label}
                type="button"
                onClick={() => setValue(sm.url)}
                className="text-[11px] px-2 py-0.5 rounded-full transition-all hover:-translate-y-0.5"
                style={{
                  background: 'var(--color-surface-muted)',
                  border: '1px solid var(--color-border-subtle)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                {sm.label}
              </button>
            ))}
          </div>

          {hasValue && (
            <div
              className="text-xs flex items-center gap-2 mt-0.5 flex-wrap"
              style={{ color: 'var(--color-text-muted)' }}
            >
              <span
                className="inline-flex items-center gap-1 font-semibold"
                style={{ color: 'var(--color-accent-primary)' }}
              >
                <Sparkles size={11} />
                {detected.label}
              </span>
              {detected.note && <span>· {detected.note}</span>}
            </div>
          )}
        </section>

        {/* ================ SECTION 2 — Note metadata ================ */}
        <section
          className="flex flex-col gap-2 rounded-xl p-3"
          style={{
            background: 'var(--color-surface-muted)',
            border: '1px dashed var(--color-border-subtle)',
          }}
        >
          <div
            className="text-[11px] uppercase tracking-wide font-semibold inline-flex items-center gap-1.5"
            style={{ color: 'var(--color-accent-primary)' }}
          >
            <BookmarkPlus size={12} />
            Lưu vào Notes (chỉ link)
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label
                htmlFor="tt-qr-title"
                className="text-[10px] uppercase tracking-wide"
                style={{ color: 'var(--color-text-muted)' }}
              >
                Tên ghi chú
              </label>
              <input
                id="tt-qr-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="VD: Hồ sơ dự án X · bản vẽ CAD…"
                className="h-9 px-3 text-sm rounded-lg outline-none"
                style={{
                  background: 'var(--color-surface-card)',
                  border: '1px solid var(--color-border-default)',
                  color: 'var(--color-text-primary)',
                }}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label
                htmlFor="tt-qr-note"
                className="text-[10px] uppercase tracking-wide"
                style={{ color: 'var(--color-text-muted)' }}
              >
                Ghi chú (tuỳ chọn)
              </label>
              <input
                id="tt-qr-note"
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="VD: Gửi cho anh A, deadline 30/04"
                className="h-9 px-3 text-sm rounded-lg outline-none"
                style={{
                  background: 'var(--color-surface-card)',
                  border: '1px solid var(--color-border-default)',
                  color: 'var(--color-text-primary)',
                }}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-1">
            <button
              type="button"
              onClick={handleSaveToNotes}
              disabled={!hasValue}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-semibold transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: savedOk
                  ? '#10B981'
                  : 'var(--color-accent-gradient)',
                color: '#ffffff',
                boxShadow:
                  '0 2px 8px rgba(74,222,128,0.28), inset 0 1px 0 rgba(255,255,255,0.18)',
              }}
            >
              {savedOk ? (
                <>
                  <Check size={13} strokeWidth={2.5} />
                  Đã lưu
                </>
              ) : (
                <>
                  <Save size={13} strokeWidth={2.5} />
                  Lưu vào Notes
                </>
              )}
            </button>
            {saved.length > 0 && (
              <button
                type="button"
                onClick={() => setShowSaved((v) => !v)}
                className="inline-flex items-center gap-1 h-9 px-2.5 rounded-lg text-xs font-medium transition-all"
                style={{
                  color: 'var(--color-text-secondary)',
                  background: 'transparent',
                  border: '1px solid var(--color-border-default)',
                }}
              >
                {showSaved ? (
                  <>
                    <ChevronUp size={13} /> Ẩn danh sách
                  </>
                ) : (
                  <>
                    <ChevronDown size={13} /> Xem {saved.length} link đã lưu
                  </>
                )}
              </button>
            )}
            <span
              className="text-[10px]"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Chỉ lưu link + tên + ghi chú vào trình duyệt này (localStorage).
            </span>
          </div>
        </section>

        {/* ================ SECTION 3 — QR preview + settings ================ */}
        <section className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-5 items-start">
          {/* Preview */}
          <div className="flex flex-col items-center gap-2">
            <div
              className="rounded-xl flex items-center justify-center relative"
              style={{
                width: size + 24,
                height: size + 24,
                background: '#ffffff',
                border: '1px solid var(--color-border-subtle)',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <canvas
                ref={canvasRef}
                width={size}
                height={size}
                style={{ display: 'block', width: size, height: size }}
              />
            </div>
            {renderErr && (
              <span
                className="text-[10px] text-center max-w-[280px]"
                style={{ color: '#DC2626' }}
              >
                {renderErr}
              </span>
            )}
          </div>

          {/* Settings */}
          <div className="flex flex-col gap-3 min-w-0">
            <div className="grid grid-cols-3 gap-2">
              <div className="flex flex-col gap-1">
                <label
                  className="text-[10px] uppercase tracking-wide"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  Kích thước
                </label>
                <select
                  value={size}
                  onChange={(e) =>
                    setSize(Number(e.target.value) as SizeOpt)
                  }
                  className="h-9 px-2 text-sm rounded-lg outline-none"
                  style={{
                    background: 'var(--color-surface-muted)',
                    border: '1px solid var(--color-border-default)',
                    color: 'var(--color-text-primary)',
                    colorScheme: 'dark light',
                  }}
                >
                  {SIZE_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}px
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label
                  className="text-[10px] uppercase tracking-wide"
                  style={{ color: 'var(--color-text-muted)' }}
                  title="Error Correction Level"
                >
                  ECC
                </label>
                <select
                  value={ecc}
                  onChange={(e) => setEcc(e.target.value as EccLevel)}
                  className="h-9 px-2 text-sm rounded-lg outline-none"
                  style={{
                    background: 'var(--color-surface-muted)',
                    border: '1px solid var(--color-border-default)',
                    color: 'var(--color-text-primary)',
                    colorScheme: 'dark light',
                  }}
                >
                  <option value="L">L · 7%</option>
                  <option value="M">M · 15%</option>
                  <option value="Q">Q · 25%</option>
                  <option value="H">H · 30%</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label
                  className="text-[10px] uppercase tracking-wide"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  Màu QR
                </label>
                <div
                  className="h-9 px-2 rounded-lg flex items-center gap-2"
                  style={{
                    background: 'var(--color-surface-muted)',
                    border: '1px solid var(--color-border-default)',
                  }}
                >
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-7 h-6 cursor-pointer bg-transparent border-0 p-0"
                    aria-label="Chọn màu QR"
                  />
                  <span
                    className="text-xs font-mono"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    {color.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>

            {hasValue && (
              <div className="flex flex-col gap-1">
                <label
                  className="text-[10px] uppercase tracking-wide"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  Link / nội dung QR đang nhúng
                </label>
                <div
                  className="text-xs px-3 py-2 rounded-lg break-all"
                  style={{
                    background: 'var(--color-surface-muted)',
                    border: '1px solid var(--color-border-subtle)',
                    color: 'var(--color-text-primary)',
                    maxHeight: 72,
                    overflow: 'auto',
                    lineHeight: 1.5,
                  }}
                >
                  {detected.converted}
                </div>
              </div>
            )}

            {/* Primary actions */}
            <div className="flex flex-wrap gap-2 mt-1">
              <button
                type="button"
                onClick={handleDownloadPNG}
                disabled={!hasValue}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-semibold transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: 'var(--color-accent-gradient)',
                  color: '#ffffff',
                  boxShadow:
                    '0 2px 8px rgba(74,222,128,0.28), inset 0 1px 0 rgba(255,255,255,0.18)',
                }}
              >
                <Download size={13} strokeWidth={2.5} />
                PNG
              </button>
              <button
                type="button"
                onClick={handleDownloadSVG}
                disabled={!hasValue}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-semibold transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: 'var(--color-surface-muted)',
                  color: 'var(--color-text-primary)',
                  border: '1px solid var(--color-border-default)',
                }}
              >
                <FileCode2 size={13} strokeWidth={2.5} />
                SVG
              </button>
              <button
                type="button"
                onClick={handleCopyImage}
                disabled={!hasValue}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-semibold transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: 'var(--color-surface-muted)',
                  color: 'var(--color-text-primary)',
                  border: '1px solid var(--color-border-default)',
                }}
              >
                {copyImgDone ? (
                  <Check size={13} strokeWidth={2.5} />
                ) : (
                  <ImageIcon size={13} strokeWidth={2.5} />
                )}
                {copyImgDone ? 'Đã copy' : 'Copy ảnh'}
              </button>
              <button
                type="button"
                onClick={handleCopyLink}
                disabled={!hasValue}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-semibold transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: 'var(--color-surface-muted)',
                  color: 'var(--color-text-primary)',
                  border: '1px solid var(--color-border-default)',
                }}
              >
                {copyLinkDone ? (
                  <Check size={13} strokeWidth={2.5} />
                ) : (
                  <Copy size={13} strokeWidth={2.5} />
                )}
                {copyLinkDone ? 'Đã copy' : 'Copy link'}
              </button>
              <button
                type="button"
                onClick={handleOpen}
                disabled={!canOpen}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-semibold transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: 'var(--color-surface-muted)',
                  color: 'var(--color-text-primary)',
                  border: '1px solid var(--color-border-default)',
                }}
              >
                <ExternalLink size={13} strokeWidth={2.5} />
                Mở
              </button>
            </div>

            {/* Share */}
            {canOpen && (
              <div className="flex flex-col gap-1">
                <label
                  className="text-[10px] uppercase tracking-wide inline-flex items-center gap-1"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  <Share2 size={11} /> Chia sẻ nhanh
                </label>
                <div className="flex flex-wrap gap-1.5">
                  <a
                    href={shareURLs.zalo}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg text-[11px] font-semibold transition-all hover:-translate-y-0.5"
                    style={{ background: '#0068FF', color: '#ffffff' }}
                  >
                    Zalo
                  </a>
                  <a
                    href={shareURLs.telegram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg text-[11px] font-semibold transition-all hover:-translate-y-0.5"
                    style={{ background: '#229ED9', color: '#ffffff' }}
                  >
                    <Send size={11} /> Telegram
                  </a>
                  <a
                    href={shareURLs.facebook}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg text-[11px] font-semibold transition-all hover:-translate-y-0.5"
                    style={{ background: '#1877F2', color: '#ffffff' }}
                  >
                    <Facebook size={11} /> Facebook
                  </a>
                  <a
                    href={shareURLs.email}
                    className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg text-[11px] font-semibold transition-all hover:-translate-y-0.5"
                    style={{ background: '#EA4335', color: '#ffffff' }}
                  >
                    <Mail size={11} /> Email
                  </a>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ================ SECTION 4 — Saved list (collapse) ================ */}
        {showSaved && saved.length > 0 && (
          <section
            className="rounded-xl overflow-hidden"
            style={{
              background: 'var(--color-surface-muted)',
              border: '1px solid var(--color-border-subtle)',
            }}
          >
            <header
              className="flex items-center justify-between px-3 py-2"
              style={{
                borderBottom: '1px solid var(--color-border-subtle)',
              }}
            >
              <span
                className="text-[11px] uppercase tracking-wide font-semibold inline-flex items-center gap-1.5"
                style={{ color: 'var(--color-text-primary)' }}
              >
                <BookmarkPlus size={12} />
                Link đã lưu ({saved.length}/{SAVED_MAX})
              </span>
              <button
                type="button"
                onClick={handleClearAllSaved}
                className="text-[10px] inline-flex items-center gap-1 transition-colors hover:opacity-80"
                style={{ color: '#DC2626' }}
              >
                <Trash2 size={11} />
                Xoá tất cả
              </button>
            </header>
            <ul className="divide-y" style={{ borderColor: 'var(--color-border-subtle)' }}>
              {saved.map((e) => (
                <li
                  key={e.id}
                  className="px-3 py-2.5 flex items-start gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div
                      className="text-sm font-semibold truncate"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      {e.title}
                    </div>
                    <div
                      className="text-[11px] truncate mt-0.5"
                      style={{ color: 'var(--color-text-muted)' }}
                      title={e.convertedUrl}
                    >
                      {e.convertedUrl}
                    </div>
                    {e.note && (
                      <div
                        className="text-[11px] mt-1 italic"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >
                        {e.note}
                      </div>
                    )}
                    <div
                      className="text-[10px] mt-1"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      {formatSavedAt(e.savedAt)}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => handleLoadSaved(e)}
                      title="Nạp lại vào ô nhập"
                      className="h-8 w-8 rounded-lg inline-flex items-center justify-center transition-all hover:-translate-y-0.5"
                      style={{
                        background: 'var(--color-surface-card)',
                        border: '1px solid var(--color-border-default)',
                        color: 'var(--color-accent-primary)',
                      }}
                      aria-label="Nạp lại"
                    >
                      <RotateCcw size={13} strokeWidth={2.25} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard
                          .writeText(e.convertedUrl)
                          .catch(() => {});
                      }}
                      title="Copy link"
                      className="h-8 w-8 rounded-lg inline-flex items-center justify-center transition-all hover:-translate-y-0.5"
                      style={{
                        background: 'var(--color-surface-card)',
                        border: '1px solid var(--color-border-default)',
                        color: 'var(--color-text-secondary)',
                      }}
                      aria-label="Copy link"
                    >
                      <Copy size={13} strokeWidth={2.25} />
                    </button>
                    <a
                      href={e.convertedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Mở link"
                      className="h-8 w-8 rounded-lg inline-flex items-center justify-center transition-all hover:-translate-y-0.5"
                      style={{
                        background: 'var(--color-surface-card)',
                        border: '1px solid var(--color-border-default)',
                        color: 'var(--color-text-secondary)',
                      }}
                      aria-label="Mở link"
                    >
                      <ExternalLink size={13} strokeWidth={2.25} />
                    </a>
                    <button
                      type="button"
                      onClick={() => handleDeleteSaved(e.id)}
                      title="Xoá mục này"
                      className="h-8 w-8 rounded-lg inline-flex items-center justify-center transition-all hover:-translate-y-0.5"
                      style={{
                        background: 'var(--color-surface-card)',
                        border: '1px solid var(--color-border-default)',
                        color: '#DC2626',
                      }}
                      aria-label="Xoá"
                    >
                      <Trash2 size={13} strokeWidth={2.25} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Footer hint */}
        <p
          className="text-[10px] italic"
          style={{ color: 'var(--color-text-muted)' }}
        >
          Tự động convert: Drive file/folder · Docs→PDF · Sheets→XLSX ·
          Slides→PPTX · Dropbox dl=1 · YouTube short URL. ECC H → QR chống
          lỗi tốt cho in ấn. Link đã lưu nằm trong localStorage trình duyệt
          này — sẽ được sync Firestore ở Phase 11.7.
        </p>
      </div>
    </WidgetCard>
  );
}
