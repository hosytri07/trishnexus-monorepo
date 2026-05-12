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
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
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
  progress?: number;
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
  const [url, setUrl] = useState('');
  const [quality, setQuality] = useState<'best' | '1080p' | '720p' | '480p' | 'audio'>('best');
  const [removeWatermark, setRemoveWatermark] = useState(true);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [toast, setToast] = useState<{ msg: string; kind: 'ok' | 'err' } | null>(null);
  const [ytdlpAvailable, setYtdlpAvailable] = useState<boolean | null>(null);
  const [outputDir, setOutputDir] = useState<string>('');

  const platform = detectPlatform(url);
  const platformInfo = PLATFORMS.find((p) => p.id === platform);

  // Phase 40.6 — Check yt-dlp + setup output dir
  useEffect(() => {
    void invoke<boolean>('check_ytdlp_available')
      .then(setYtdlpAvailable)
      .catch(() => setYtdlpAvailable(false));
    void documentDir()
      .then((d) => join(d, 'TrishDrive', 'MediaDownloads'))
      .then(setOutputDir)
      .catch(() => setOutputDir('Documents/TrishDrive/MediaDownloads'));
  }, []);

  async function handleAdd(): Promise<void> {
    if (!url.trim()) {
      setToast({ msg: 'Vui lòng paste link video', kind: 'err' });
      return;
    }
    if (platform === 'unknown') {
      setToast({
        msg: 'Link không thuộc nền tảng hỗ trợ (YouTube/TikTok/FB/IG/X)',
        kind: 'err',
      });
      return;
    }
    if (!ytdlpAvailable) {
      setToast({ msg: 'yt-dlp chưa cài — xem hướng dẫn cài bên dưới', kind: 'err' });
      return;
    }

    const item: QueueItem = {
      id: `dl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      url: url.trim(),
      platform,
      status: 'downloading',
    };
    setQueue((q) => [item, ...q]);
    setUrl('');
    setToast({ msg: `🎬 Đang tải (${platformInfo?.name})...`, kind: 'ok' });

    // Phase 40.6 — Gọi Rust command thật
    try {
      const result = await invoke<{ ok: boolean; output_path?: string; stderr: string }>(
        'download_social_media',
        {
          url: item.url,
          quality,
          outputDir,
          removeWatermark,
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
        setToast({ msg: `✅ Đã tải xong → ${outputDir}`, kind: 'ok' });
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
        q.map((it) =>
          it.id === item.id ? { ...it, status: 'error', error: msg } : it,
        ),
      );
    }
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
          Link video
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <LinkIcon
              style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                width: 16,
                height: 16,
                color: 'var(--color-text-muted)',
              }}
            />
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleAdd();
              }}
              placeholder="https://www.tiktok.com/@user/video/..."
              style={{
                width: '100%',
                padding: '10px 12px 10px 36px',
                borderRadius: 8,
                border: '1px solid var(--color-border-default)',
                background: 'var(--color-surface-bg)',
                color: 'var(--color-text-primary)',
                fontSize: 13,
                outline: 'none',
              }}
            />
          </div>
          <button
            type="button"
            onClick={() => void handleAdd()}
            disabled={!url.trim()}
            className="btn-primary"
            style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}
          >
            <DownloadIcon className="h-4 w-4" /> Thêm vào queue
          </button>
        </div>

        {url && platform !== 'unknown' && platformInfo && (
          <div
            style={{
              marginTop: 10,
              padding: '8px 12px',
              background: 'rgba(16,185,129,0.08)',
              border: '1px solid rgba(16,185,129,0.3)',
              borderRadius: 8,
              fontSize: 12,
              color: '#065F46',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <CheckCircle2 style={{ width: 14, height: 14 }} />
            Phát hiện: <strong>{platformInfo.emoji} {platformInfo.name}</strong>
          </div>
        )}
        {url && platform === 'unknown' && (
          <div
            style={{
              marginTop: 10,
              padding: '8px 12px',
              background: 'rgba(220,38,38,0.08)',
              border: '1px solid rgba(220,38,38,0.3)',
              borderRadius: 8,
              fontSize: 12,
              color: '#991B1B',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <AlertCircle style={{ width: 14, height: 14 }} />
            Link không thuộc nền tảng hỗ trợ
          </div>
        )}

        {/* Options */}
        <div
          style={{
            marginTop: 14,
            paddingTop: 14,
            borderTop: '1px solid var(--color-border-subtle)',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 14,
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
              Tùy chọn TikTok
            </label>
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 12px',
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
              Xóa watermark TikTok
            </label>
          </div>
        </div>
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
                    {item.url}
                  </div>
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
                      <span style={{ color: '#065F46' }}>✅ Hoàn thành</span>
                    )}
                  </div>
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
            padding: 14,
            borderRadius: 10,
            background: 'rgba(220,38,38,0.08)',
            border: '1px solid rgba(220,38,38,0.3)',
            fontSize: 12,
            color: '#991B1B',
            lineHeight: 1.6,
          }}
        >
          <strong>⚠ Cần cài yt-dlp</strong> — Module Tải video cần engine yt-dlp để tải.
          Cài 1 lần là dùng được mãi:
          <pre style={{ marginTop: 8, padding: 10, background: 'rgba(0,0,0,0.08)', borderRadius: 6, fontSize: 11, fontFamily: 'monospace', overflowX: 'auto' }}>
{`# PowerShell (Windows) — chạy lệnh:
winget install yt-dlp.yt-dlp

# Hoặc tải trực tiếp từ:
# https://github.com/yt-dlp/yt-dlp/releases`}
          </pre>
          Sau khi cài → restart TrishDrive (đóng và mở lại app) → nút check sẽ tự nhận.
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
          }}
        >
          <div>
            <CheckCircle2 style={{ width: 14, height: 14, display: 'inline', verticalAlign: -2 }} />{' '}
            yt-dlp đã sẵn sàng · Lưu tại: <code style={{ fontFamily: 'monospace', fontSize: 11 }}>{outputDir}</code>
          </div>
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
      )}
    </div>
  );
}
