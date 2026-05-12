/**
 * MediaDownloadScreen — Phase 40.6.
 *
 * Tab "Tải video MXH" — cho phép paste link video từ Facebook / TikTok /
 * YouTube / Instagram / Twitter (X) và tải về máy.
 *
 * Hiện tại là SCAFFOLD MVP (UI đầy đủ + queue placeholder). Backend yt-dlp Rust
 * integration sẽ build ở Phase 41 (cần bundle yt-dlp binary ~30MB hoặc gọi
 * external Python module).
 *
 * Hỗ trợ platform dự kiến:
 *  - YouTube (video + playlist)
 *  - TikTok (video + watermark removal option)
 *  - Facebook (public videos)
 *  - Instagram (post + reel + story)
 *  - Twitter/X (video tweet)
 */

import { useEffect, useState } from 'react';
import {
  Video,
  Link as LinkIcon,
  Download as DownloadIcon,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
  FolderOpen,
  Lock,
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { documentDir, join } from '@tauri-apps/api/path';
import { openUrl } from '@tauri-apps/plugin-opener';

type PlatformId = 'youtube' | 'tiktok' | 'facebook' | 'instagram' | 'twitter' | 'unknown';

interface Platform {
  id: PlatformId;
  name: string;
  emoji: string;
  domains: string[];
}

const PLATFORMS: Platform[] = [
  { id: 'youtube', name: 'YouTube', emoji: '🎬', domains: ['youtube.com', 'youtu.be'] },
  { id: 'tiktok', name: 'TikTok', emoji: '🎵', domains: ['tiktok.com', 'vm.tiktok.com'] },
  { id: 'facebook', name: 'Facebook', emoji: '📘', domains: ['facebook.com', 'fb.watch'] },
  { id: 'instagram', name: 'Instagram', emoji: '📷', domains: ['instagram.com'] },
  { id: 'twitter', name: 'Twitter / X', emoji: '🐦', domains: ['twitter.com', 'x.com'] },
];

interface QueueItem {
  id: string;
  url: string;
  platform: PlatformId;
  status: 'pending' | 'analyzing' | 'downloading' | 'done' | 'error';
  title?: string;
  /** Phase 40.16 — Realtime progress */
  percent?: string;
  downloaded?: string;
  total?: string;
  speed?: string;
  eta?: string;
  error?: string;
}

function detectPlatform(url: string): PlatformId {
  const lower = url.toLowerCase();
  for (const p of PLATFORMS) {
    if (p.domains.some((d) => lower.includes(d))) return p.id;
  }
  return 'unknown';
}

export function MediaDownloadScreen(): JSX.Element {
  const [urls, setUrls] = useState('');
  const [quality, setQuality] = useState<'best' | '1080p' | '720p' | '480p' | 'audio'>('best');
  const [removeWatermark, setRemoveWatermark] = useState(true);
  const [downloadPlaylist, setDownloadPlaylist] = useState(false);
  const [cookiesBrowser, setCookiesBrowser] = useState<string>('none');
  const [cookiesFile, setCookiesFile] = useState<string>('');
  const [outputFormat, setOutputFormat] = useState<string>('auto');
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [toast, setToast] = useState<{ msg: string; kind: 'ok' | 'err' } | null>(null);
  const [ytdlpAvailable, setYtdlpAvailable] = useState<boolean | null>(null);
  const [installing, setInstalling] = useState(false);
  const [ffmpegAvailable, setFfmpegAvailable] = useState<boolean | null>(null);
  const [installingFfmpeg, setInstallingFfmpeg] = useState(false);
  const [updatingYtdlp, setUpdatingYtdlp] = useState(false);
  const [outputDir, setOutputDir] = useState<string>('');

  // Phase 40.16 — Listen progress events từ Rust
  useEffect(() => {
    let unlisten: UnlistenFn | null = null;
    listen<{
      url: string;
      status: string;
      percent?: string;
      downloaded?: string;
      total?: string;
      speed?: string;
      eta?: string;
      path?: string;
    }>('media-download:progress', (event) => {
      const p = event.payload;
      setQueue((q) =>
        q.map((it) => {
          if (it.url !== p.url) return it;
          if (p.status === 'downloading') {
            return { ...it, status: 'downloading', percent: p.percent, downloaded: p.downloaded, total: p.total, speed: p.speed, eta: p.eta };
          }
          if (p.status === 'saving' && p.path) {
            return { ...it, title: p.path.split(/[\\/]/).pop() };
          }
          return it;
        }),
      );
    }).then((fn) => { unlisten = fn; });
    return () => { if (unlisten) unlisten(); };
  }, []);

  // Parse multi-line URLs
  const parsedUrls = urls.split('\n').map((u) => u.trim()).filter((u) => u.length > 0);
  const firstUrl = parsedUrls[0] ?? '';
  const platform = detectPlatform(firstUrl);
  const platformInfo = PLATFORMS.find((p) => p.id === platform);

  // Phase 40.6 + 40.18 — Check yt-dlp + ffmpeg + setup output dir
  useEffect(() => {
    void invoke<boolean>('check_ytdlp_available').then(setYtdlpAvailable).catch(() => setYtdlpAvailable(false));
    void invoke<boolean>('check_ffmpeg_available').then(setFfmpegAvailable).catch(() => setFfmpegAvailable(false));
    void documentDir()
      .then((d) => join(d, 'TrishDrive', 'MediaDownloads'))
      .then(setOutputDir)
      .catch(() => setOutputDir('Documents/TrishDrive/MediaDownloads'));
  }, []);

  async function handleInstallFfmpeg(): Promise<void> {
    if (installingFfmpeg) return;
    setInstallingFfmpeg(true);
    setToast({ msg: '⏳ Đang tải ffmpeg ~100MB từ gyan.dev (chậm hơn yt-dlp)...', kind: 'ok' });
    try {
      await invoke<string>('install_ffmpeg');
      setFfmpegAvailable(true);
      setToast({ msg: '✅ Đã cài ffmpeg — giờ tải MP3/MP4 OK', kind: 'ok' });
    } catch (e) {
      setToast({ msg: `⚠ Cài ffmpeg fail: ${e instanceof Error ? e.message : String(e)}`, kind: 'err' });
    } finally {
      setInstallingFfmpeg(false);
    }
  }

  async function handleUpdateYtdlp(): Promise<void> {
    if (updatingYtdlp) return;
    setUpdatingYtdlp(true);
    setToast({ msg: '⏳ Đang update yt-dlp...', kind: 'ok' });
    try {
      const out = await invoke<string>('update_ytdlp');
      setToast({ msg: `✅ Update OK: ${out.slice(0, 100)}`, kind: 'ok' });
    } catch (e) {
      setToast({ msg: `⚠ Update fail: ${e instanceof Error ? e.message : String(e)}`, kind: 'err' });
    } finally {
      setUpdatingYtdlp(false);
    }
  }

  async function handleInstallYtdlp(): Promise<void> {
    if (installing) return;
    setInstalling(true);
    setToast({ msg: '⏳ Đang tải yt-dlp.exe từ GitHub (~17 MB)...', kind: 'ok' });
    try {
      const path = await invoke<string>('install_ytdlp');
      setYtdlpAvailable(true);
      setToast({ msg: `✅ Đã cài yt-dlp vào ${path.split(/[\\/]/).slice(-3).join('/')}`, kind: 'ok' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setToast({ msg: `⚠ Cài fail: ${msg}`, kind: 'err' });
    } finally {
      setInstalling(false);
    }
  }

  async function handleAdd(): Promise<void> {
    if (parsedUrls.length === 0) {
      setToast({ msg: 'Vui lòng paste ít nhất 1 link', kind: 'err' });
      return;
    }
    if (!ytdlpAvailable) {
      setToast({ msg: 'yt-dlp chưa cài — bấm "Cài tự động" bên dưới', kind: 'err' });
      return;
    }

    // Validate URLs + tạo queue items
    const newItems: QueueItem[] = [];
    for (const u of parsedUrls) {
      const p = detectPlatform(u);
      if (p === 'unknown') {
        setQueue((q) => [
          {
            id: `dl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            url: u,
            platform: 'unknown',
            status: 'error',
            error: 'Link không thuộc nền tảng hỗ trợ',
          },
          ...q,
        ]);
        continue;
      }
      newItems.push({
        id: `dl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        url: u,
        platform: p,
        status: 'pending',
      });
    }

    if (newItems.length === 0) {
      setToast({ msg: 'Không có link hợp lệ', kind: 'err' });
      return;
    }

    setQueue((q) => [...newItems, ...q]);
    setUrls('');
    setToast({ msg: `🎬 Đang xử lý ${newItems.length} link${downloadPlaylist ? ' (kèm playlist)' : ''}...`, kind: 'ok' });

    // Tải tuần tự (parallel rủi ro với yt-dlp + IP rate limit)
    for (const item of newItems) {
      setQueue((q) => q.map((it) => (it.id === item.id ? { ...it, status: 'downloading' } : it)));
      try {
        const result = await invoke<{ ok: boolean; output_path?: string; stderr: string }>(
          'download_social_media',
          {
            url: item.url,
            quality,
            outputDir,
            removeWatermark,
            downloadPlaylist,
            cookiesBrowser: cookiesBrowser === 'none' ? null : cookiesBrowser,
            cookiesFile: cookiesFile || null,
            outputFormat: outputFormat === 'auto' ? null : outputFormat,
          },
        );

        if (result.ok) {
          setQueue((q) =>
            q.map((it) =>
              it.id === item.id
                ? { ...it, status: 'done', title: result.output_path?.split(/[\\/]/).pop() }
                : it,
            ),
          );
        } else {
          setQueue((q) =>
            q.map((it) =>
              it.id === item.id
                ? { ...it, status: 'error', error: result.stderr.slice(0, 200) || 'yt-dlp failed' }
                : it,
            ),
          );
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setQueue((q) =>
          q.map((it) => (it.id === item.id ? { ...it, status: 'error', error: msg } : it)),
        );
      }
    }

    setToast({ msg: `✅ Đã xử lý xong ${newItems.length} link`, kind: 'ok' });
  }

  function handleRemove(id: string): void {
    setQueue((q) => q.filter((it) => it.id !== id));
  }

  function handleClearDone(): void {
    setQueue((q) => q.filter((it) => it.status !== 'done' && it.status !== 'error'));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div
        style={{
          padding: 20,
          borderRadius: 14,
          background:
            'linear-gradient(135deg, rgba(239,68,68,0.08) 0%, rgba(168,85,247,0.08) 100%)',
          border: '1px solid var(--color-border-subtle)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: 'rgba(239,68,68,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Video style={{ width: 24, height: 24, color: '#DC2626' }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--color-text-primary)' }}>
              Tải video mạng xã hội
            </h1>
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: 0, marginTop: 2 }}>
              Paste link từ YouTube · TikTok · Facebook · Instagram · X (Twitter) → tải về máy
            </p>
          </div>
        </div>
      </div>

      {/* Supported platforms */}
      <div
        style={{
          padding: 16,
          borderRadius: 12,
          background: 'var(--color-surface-card)',
          border: '1px solid var(--color-border-subtle)',
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--color-text-muted)',
            textTransform: 'uppercase',
            letterSpacing: 0.4,
            marginBottom: 10,
          }}
        >
          Nền tảng hỗ trợ
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {PLATFORMS.map((p) => (
            <span
              key={p.id}
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                background: 'var(--color-surface-row)',
                fontSize: 13,
                color: 'var(--color-text-primary)',
                fontWeight: 500,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span>{p.emoji}</span>
              {p.name}
            </span>
          ))}
        </div>
      </div>

      {/* URL input + options */}
      <div
        style={{
          padding: 18,
          borderRadius: 12,
          background: 'var(--color-surface-card)',
          border: '1px solid var(--color-border-subtle)',
        }}
      >
        <label
          style={{
            display: 'block',
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--color-text-muted)',
            textTransform: 'uppercase',
            letterSpacing: 0.4,
            marginBottom: 6,
          }}
        >
          Link video (mỗi dòng 1 link — paste nhiều cùng lúc OK)
        </label>
        <div style={{ position: 'relative', marginBottom: 8 }}>
          <LinkIcon
            style={{
              position: 'absolute',
              left: 12,
              top: 12,
              width: 16,
              height: 16,
              color: 'var(--color-text-muted)',
            }}
          />
          <textarea
            value={urls}
            onChange={(e) => setUrls(e.target.value)}
            placeholder="https://www.tiktok.com/@user/video/...&#10;https://youtube.com/watch?v=...&#10;https://www.facebook.com/watch?v=..."
            rows={4}
            style={{
              width: '100%',
              padding: '10px 12px 10px 36px',
              borderRadius: 8,
              border: '1px solid var(--color-border-default)',
              background: 'var(--color-surface-bg)',
              color: 'var(--color-text-primary)',
              fontSize: 13,
              outline: 'none',
              fontFamily: 'monospace',
              resize: 'vertical',
              minHeight: 80,
            }}
          />
        </div>

        {parsedUrls.length > 0 && (
          <div
            style={{
              padding: '8px 12px',
              background: 'rgba(16,185,129,0.08)',
              border: '1px solid rgba(16,185,129,0.3)',
              borderRadius: 8,
              fontSize: 12,
              color: '#065F46',
              marginBottom: 10,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              flexWrap: 'wrap',
            }}
          >
            <CheckCircle2 style={{ width: 14, height: 14 }} />
            Phát hiện <strong>{parsedUrls.length} link</strong>
            {(() => {
              const platforms = new Set(parsedUrls.map(detectPlatform).filter((p) => p !== 'unknown'));
              return [...platforms].map((p) => {
                const info = PLATFORMS.find((x) => x.id === p);
                return <span key={p}>{info?.emoji} {info?.name}</span>;
              });
            })()}
          </div>
        )}

        <button
          type="button"
          onClick={() => void handleAdd()}
          disabled={parsedUrls.length === 0 || !ytdlpAvailable}
          className="btn-primary"
          style={{ padding: '10px 16px', whiteSpace: 'nowrap', width: '100%', justifyContent: 'center' }}
        >
          <DownloadIcon className="h-4 w-4" />{' '}
          Tải xuống {parsedUrls.length > 0 && `(${parsedUrls.length})`}
        </button>

        {/* Options */}
        <div
          style={{
            marginTop: 14,
            paddingTop: 14,
            borderTop: '1px solid var(--color-border-subtle)',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 12,
          }}
        >
          <div>
            <label
              style={{
                display: 'block',
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--color-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: 0.4,
                marginBottom: 6,
              }}
            >
              Chất lượng
            </label>
            <select
              value={quality}
              onChange={(e) => setQuality(e.target.value as typeof quality)}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: 8,
                border: '1px solid var(--color-border-default)',
                background: 'var(--color-surface-bg)',
                color: 'var(--color-text-primary)',
                fontSize: 13,
                outline: 'none',
              }}
            >
              <option value="best">🎬 Cao nhất có sẵn</option>
              <option value="1080p">📺 1080p (Full HD)</option>
              <option value="720p">📱 720p (HD)</option>
              <option value="480p">💾 480p (Tiết kiệm dung lượng)</option>
              <option value="audio">🎵 Chỉ tải audio (MP3)</option>
            </select>
          </div>
          <div>
            <label
              style={{
                display: 'block',
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--color-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: 0.4,
                marginBottom: 6,
              }}
            >
              TikTok
            </label>
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 10px',
                borderRadius: 8,
                border: '1px solid var(--color-border-default)',
                background: 'var(--color-surface-bg)',
                cursor: 'pointer',
                fontSize: 12,
                color: 'var(--color-text-primary)',
              }}
            >
              <input
                type="checkbox"
                checked={removeWatermark}
                onChange={(e) => setRemoveWatermark(e.target.checked)}
                style={{ accentColor: 'var(--color-accent-primary)' }}
              />
              Xóa watermark
            </label>
          </div>
          <div>
            <label
              style={{
                display: 'block',
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--color-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: 0.4,
                marginBottom: 6,
              }}
            >
              Playlist (YT)
            </label>
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 10px',
                borderRadius: 8,
                border: '1px solid var(--color-border-default)',
                background: 'var(--color-surface-bg)',
                cursor: 'pointer',
                fontSize: 12,
                color: 'var(--color-text-primary)',
              }}
            >
              <input
                type="checkbox"
                checked={downloadPlaylist}
                onChange={(e) => setDownloadPlaylist(e.target.checked)}
                style={{ accentColor: 'var(--color-accent-primary)' }}
              />
              Tải cả playlist
            </label>
          </div>
          {/* Phase 40.16 — Private video qua cookies từ browser */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--color-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: 0.4,
                marginBottom: 6,
              }}
            >
              <Lock style={{ width: 11, height: 11, display: 'inline', marginRight: 4 }} /> Video private
            </label>
            <select
              value={cookiesBrowser}
              onChange={(e) => setCookiesBrowser(e.target.value)}
              title="Dùng cookies từ trình duyệt đã login để tải video private/login-required"
              style={{
                width: '100%',
                padding: '7px 8px',
                borderRadius: 8,
                border: '1px solid var(--color-border-default)',
                background: 'var(--color-surface-bg)',
                color: 'var(--color-text-primary)',
                fontSize: 12,
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="none">— Không (public only) —</option>
              <option value="firefox">🔥 Firefox (Recommended)</option>
              <option value="chrome">🟢 Chrome (đóng app trước)</option>
              <option value="edge">📘 Edge (đóng app trước)</option>
              <option value="brave">🦁 Brave</option>
              <option value="opera">🔴 Opera</option>
            </select>
          </div>
          {/* Phase 40.17 — Output format */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--color-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: 0.4,
                marginBottom: 6,
              }}
            >
              📁 Định dạng file
            </label>
            <select
              value={outputFormat}
              onChange={(e) => setOutputFormat(e.target.value)}
              title="Chuyển đổi sang format mong muốn (yt-dlp tự convert)"
              style={{
                width: '100%',
                padding: '7px 8px',
                borderRadius: 8,
                border: '1px solid var(--color-border-default)',
                background: 'var(--color-surface-bg)',
                color: 'var(--color-text-primary)',
                fontSize: 12,
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="auto">🎯 Tự động</option>
              <optgroup label="📹 Video">
                <option value="mp4">🎬 MP4 (phổ biến)</option>
                <option value="webm">🌐 WebM</option>
                <option value="mkv">📼 MKV (chất lượng cao)</option>
              </optgroup>
              <optgroup label="🎵 Audio only">
                <option value="mp3">🎵 MP3 (phổ biến)</option>
                <option value="m4a">🎶 M4A (chất lượng cao hơn MP3)</option>
                <option value="opus">🎼 Opus (nhỏ nhất)</option>
                <option value="flac">💎 FLAC (lossless)</option>
              </optgroup>
            </select>
          </div>
        </div>

        {/* Phase 40.17 — Cookies.txt advanced (workaround Chrome lock) */}
        {cookiesBrowser !== 'none' && (
          <details style={{ marginTop: 10, fontSize: 11, color: 'var(--color-text-muted)' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
              ⚠ Chrome bị lỗi cookies? Click xem cách khắc phục
            </summary>
            <div style={{ marginTop: 8, padding: 10, background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 6, lineHeight: 1.6 }}>
              <strong style={{ color: '#92400E' }}>Lỗi "Could not copy Chrome cookie database":</strong> Chrome đang
              chạy → DB bị lock. 3 cách fix (theo độ ưu tiên):
              <ol style={{ paddingLeft: 18, margin: '6px 0' }}>
                <li><strong>Đóng Chrome hoàn toàn</strong> (kể cả tray icon) → thử lại</li>
                <li><strong>Đổi sang Firefox</strong> (không bị lock) — đăng nhập tài khoản trên Firefox</li>
                <li><strong>Export cookies.txt thủ công:</strong> cài extension <em>"Get cookies.txt LOCALLY"</em> trên Chrome → vào trang video → click extension → Export → upload file bên dưới:</li>
              </ol>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 6 }}>
                <input
                  type="text"
                  className="input"
                  value={cookiesFile}
                  onChange={(e) => setCookiesFile(e.target.value)}
                  placeholder="Path đến cookies.txt (vd C:\Users\...\cookies.txt)"
                  style={{ flex: 1, fontFamily: 'monospace', fontSize: 11 }}
                />
                {cookiesFile && (
                  <button type="button" onClick={() => setCookiesFile('')} className="btn-secondary" style={{ padding: '4px 8px', fontSize: 10 }}>Xóa</button>
                )}
              </div>
              <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 4 }}>
                Nếu set cookies.txt → sẽ override dropdown trình duyệt
              </div>
            </div>
          </details>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div
          onClick={() => setToast(null)}
          style={{
            padding: 10,
            borderRadius: 8,
            cursor: 'pointer',
            background:
              toast.kind === 'ok' ? 'rgba(16,185,129,0.1)' : 'rgba(220,38,38,0.1)',
            border: `1px solid ${toast.kind === 'ok' ? '#10B981' : '#DC2626'}`,
            color: toast.kind === 'ok' ? '#065F46' : '#991B1B',
            fontSize: 13,
          }}
        >
          {toast.msg} <span style={{ opacity: 0.6, fontSize: 11 }}>(click đóng)</span>
        </div>
      )}

      {/* Queue */}
      {queue.length > 0 && (
        <div
          style={{
            borderRadius: 12,
            background: 'var(--color-surface-card)',
            border: '1px solid var(--color-border-subtle)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--color-border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)' }}>
              Queue ({queue.length})
            </div>
            <button
              type="button"
              onClick={handleClearDone}
              className="btn-secondary"
              style={{ padding: '4px 10px', fontSize: 11 }}
            >
              <Trash2 style={{ width: 12, height: 12 }} /> Xóa đã xong/lỗi
            </button>
          </div>
          {queue.map((item) => {
            const p = PLATFORMS.find((x) => x.id === item.platform);
            // Parse percent string "12.5%" → 12.5
            const pctNum = item.percent ? parseFloat(item.percent.replace('%', '').trim()) : 0;
            return (
              <div
                key={item.id}
                style={{
                  padding: 12,
                  borderBottom: '1px solid var(--color-border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: 'var(--color-surface-row)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 18,
                    flexShrink: 0,
                  }}
                >
                  {p?.emoji ?? '🎬'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'var(--color-text-primary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.title || item.url}
                  </div>
                  {/* Progress bar khi đang downloading */}
                  {item.status === 'downloading' && item.percent && (
                    <div style={{ marginTop: 6 }}>
                      <div style={{ height: 6, background: 'var(--color-surface-row)', borderRadius: 3, overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${Math.max(0, Math.min(100, pctNum))}%`,
                            height: '100%',
                            background: 'linear-gradient(90deg, #10B981, #059669)',
                            transition: 'width 0.2s',
                          }}
                        />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--color-text-muted)', marginTop: 3, fontFamily: 'monospace' }}>
                        <span>
                          <strong style={{ color: '#10B981' }}>{item.percent}</strong>
                          {' · '}
                          {item.downloaded ?? '—'} / {item.total ?? '—'}
                        </span>
                        <span>
                          {item.speed ?? '—'} · ETA {item.eta ?? '—'}
                        </span>
                      </div>
                    </div>
                  )}
                  {item.status !== 'downloading' && (
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
                      {item.status === 'pending' && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Loader2 className="animate-spin" style={{ width: 12, height: 12 }} />
                          Đang chờ…
                        </span>
                      )}
                      {item.status === 'error' && (
                        <span style={{ color: '#DC2626' }}>⚠ {item.error}</span>
                      )}
                      {item.status === 'done' && (
                        <span style={{ color: '#065F46' }}>✅ Hoàn thành — {item.title}</span>
                      )}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleRemove(item.id)}
                  className="btn-secondary"
                  style={{ padding: '4px 8px', fontSize: 11 }}
                  title="Xóa khỏi queue"
                >
                  <Trash2 style={{ width: 12, height: 12 }} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* yt-dlp availability banner */}
      {ytdlpAvailable === false && (
        <div
          style={{
            marginTop: 8,
            padding: 16,
            borderRadius: 10,
            background: 'rgba(245,158,11,0.08)',
            border: '1px solid rgba(245,158,11,0.3)',
            fontSize: 13,
            color: '#92400E',
            lineHeight: 1.6,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <AlertCircle style={{ width: 18, height: 18 }} />
            <strong>Cần cài engine yt-dlp</strong> — TrishDrive sẽ tự tải về AppData (~17 MB),
            không ảnh hưởng phần mềm khác. Chỉ cài 1 lần là dùng được mãi.
          </div>
          <button
            type="button"
            onClick={() => void handleInstallYtdlp()}
            disabled={installing}
            className="btn-primary"
            style={{
              width: '100%',
              padding: '12px',
              fontSize: 14,
              fontWeight: 700,
              justifyContent: 'center',
              marginTop: 4,
              background: installing ? 'var(--color-border-default)' : '#F59E0B',
            }}
          >
            {installing ? (
              <>
                <Loader2 className="animate-spin h-4 w-4" /> Đang tải yt-dlp.exe từ GitHub...
              </>
            ) : (
              <>📥 Cài yt-dlp tự động (1 click)</>
            )}
          </button>
          <details style={{ marginTop: 10, fontSize: 11 }}>
            <summary style={{ cursor: 'pointer' }}>Hoặc cài thủ công (chuyên gia)</summary>
            <pre style={{ marginTop: 6, padding: 8, background: 'rgba(0,0,0,0.08)', borderRadius: 6, fontFamily: 'monospace', overflowX: 'auto' }}>
{`# PowerShell:
winget install yt-dlp.yt-dlp

# Hoặc tải trực tiếp:
# https://github.com/yt-dlp/yt-dlp/releases`}
            </pre>
          </details>
        </div>
      )}
      {ytdlpAvailable === true && (
        <div
          style={{
            marginTop: 8,
            padding: 12,
            borderRadius: 10,
            background: 'rgba(16,185,129,0.08)',
            border: '1px solid rgba(16,185,129,0.3)',
            fontSize: 12,
            color: '#065F46',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <CheckCircle2 style={{ width: 14, height: 14, display: 'inline', verticalAlign: -2 }} />{' '}
            yt-dlp sẵn sàng · {ffmpegAvailable ? '✅ ffmpeg OK' : '⚠ ffmpeg thiếu'}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              onClick={() => void handleUpdateYtdlp()}
              disabled={updatingYtdlp}
              className="btn-secondary"
              style={{ padding: '4px 10px', fontSize: 11 }}
              title="Update yt-dlp (fix lỗi cookies/format mới)"
            >
              {updatingYtdlp ? <Loader2 className="animate-spin" style={{ width: 12, height: 12 }} /> : '🔄'} Update yt-dlp
            </button>
            <button
              type="button"
              onClick={() => void openUrl(outputDir)}
              className="btn-secondary"
              style={{ padding: '4px 10px', fontSize: 11 }}
              title="Mở thư mục lưu"
            >
              <FolderOpen style={{ width: 12, height: 12 }} /> Mở thư mục
            </button>
          </div>
        </div>
      )}

      {/* Phase 40.18 — ffmpeg banner */}
      {ytdlpAvailable === true && ffmpegAvailable === false && (
        <div
          style={{
            marginTop: 8,
            padding: 14,
            borderRadius: 10,
            background: 'rgba(245,158,11,0.08)',
            border: '1px solid rgba(245,158,11,0.3)',
            fontSize: 13,
            color: '#92400E',
            lineHeight: 1.6,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <AlertCircle style={{ width: 18, height: 18 }} />
            <strong>Cần cài ffmpeg để convert MP3/MP4/MKV + merge video+audio</strong>
          </div>
          <p style={{ fontSize: 12, margin: '0 0 8px' }}>
            ffmpeg ~100MB, tải 1 lần dùng mãi. Không cài thì: chọn MP3/format khác sẽ fail · Video 1080p+ không có audio (vì YT tách stream).
          </p>
          <button
            type="button"
            onClick={() => void handleInstallFfmpeg()}
            disabled={installingFfmpeg}
            className="btn-primary"
            style={{
              width: '100%',
              padding: '12px',
              fontSize: 14,
              fontWeight: 700,
              justifyContent: 'center',
              background: installingFfmpeg ? 'var(--color-border-default)' : '#F59E0B',
            }}
          >
            {installingFfmpeg ? (
              <>
                <Loader2 className="animate-spin h-4 w-4" /> Đang tải ffmpeg (~100MB, có thể mất 1-3 phút)...
              </>
            ) : (
              <>📥 Cài ffmpeg tự động (1 click)</>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
