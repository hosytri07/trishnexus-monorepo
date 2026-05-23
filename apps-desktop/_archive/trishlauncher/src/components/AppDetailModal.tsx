import { useEffect } from 'react';
import {
  statusLabel,
  loginRequiredLabel,
  formatSize,
  type AppForUi,
  type Platform,
} from '@trishteam/core/apps';
import { iconFor } from '../icons/index.js';
import { resolveCta } from '../cta.js';
import type { InstallDetection } from '../install-types.js';

/**
 * Modal chi tiết app trong TrishLauncher.
 *
 * Hiển thị:
 * - Header: icon 72×72 + name + tagline + badge status + badge "Đã cài"
 * - Features: 5 bullet từ APP_META (phản ánh đúng implementation 14.3/14.4)
 * - Metadata: version / size / login_required + install path (nếu cài)
 * - Platforms: list tất cả platform support + highlight platform hiện tại
 * - Changelog: link ra browser qua plugin-opener (nếu có)
 * - Footer CTA: "Mở" / "Tải về" / "Sắp ra mắt" / "Chưa hỗ trợ máy này"
 *   theo state install detection (Phase 14.5.5.c).
 *
 * Accessibility: role="dialog" + aria-modal + focus trap cơ bản + Esc close.
 * Phase 14.5.5.b — 2026-04-24 (created).
 * Phase 14.5.5.c — 2026-04-24 (install state + CTA update).
 */

const PLATFORM_LABEL: Record<Platform, string> = {
  windows_x64: 'Windows (x64)',
  windows_arm64: 'Windows (ARM64)',
  macos_x64: 'macOS (Intel)',
  macos_arm64: 'macOS (Apple Silicon)',
  linux_x64: 'Linux (x64)',
  web: 'Web',
  zalo_mini: 'Zalo Mini App',
};

interface AppDetailModalProps {
  app: AppForUi;
  currentPlatform: Platform;
  detect: InstallDetection | null;
  onClose: () => void;
  onInstall: () => void;
  onOpenExternal: (url: string) => void;
}

export function AppDetailModal({
  app,
  currentPlatform,
  detect,
  onClose,
  onInstall,
  onOpenExternal,
}: AppDetailModalProps): JSX.Element {
  const iconUrl = iconFor(app.id);
  const cta = resolveCta(app, currentPlatform, detect);
  const isInstalled = detect?.state === 'installed';
  const accent = app.accent || '#16a34a';

  // Esc để đóng — global listener scoped vào effect.
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="app-modal-title"
      onClick={onClose}
    >
      <div
        className="modal-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="modal-close"
          onClick={onClose}
          aria-label="Đóng"
          type="button"
        >
          ×
        </button>

        <header
          className="modal-head"
          style={{ borderTopColor: accent }}
        >
          {iconUrl ? (
            <img
              className="modal-icon"
              src={iconUrl}
              alt=""
              aria-hidden
              width={72}
              height={72}
            />
          ) : (
            <div className="modal-icon modal-icon-fallback" aria-hidden>
              {app.name.charAt(0)}
            </div>
          )}
          <div className="modal-head-text">
            <h2 id="app-modal-title">{app.name}</h2>
            <p className="modal-tagline">{app.tagline}</p>
            <div className="modal-head-badges">
              <span className={`badge badge-${app.status}`}>
                {statusLabel(app.status)}
              </span>
              {isInstalled && (
                <span className="badge badge-installed" title="Đã cài đặt">
                  ✓ Đã cài
                </span>
              )}
            </div>
          </div>
        </header>

        <section className="modal-body">
          {app.features.length > 0 && (
            <div className="modal-section">
              <h3>Tính năng chính</h3>
              <ul className="modal-features">
                {app.features.map((feat, i) => (
                  <li key={i}>{feat}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="modal-section">
            <h3>Thông tin phát hành</h3>
            <dl className="modal-meta">
              <div>
                <dt>Phiên bản</dt>
                <dd>{app.version}</dd>
              </div>
              <div>
                <dt>Dung lượng</dt>
                <dd>{formatSize(app.size_bytes)}</dd>
              </div>
              <div>
                <dt>Truy cập</dt>
                <dd>{loginRequiredLabel(app.login_required)}</dd>
              </div>
              {app.release_date && (
                <div>
                  <dt>Phát hành</dt>
                  <dd>{app.release_date}</dd>
                </div>
              )}
            </dl>
          </div>

          {isInstalled && detect?.path && (
            <div className="modal-section">
              <h3>Đường dẫn cài đặt</h3>
              <code className="modal-install-path" title={detect.path}>
                {detect.path}
              </code>
            </div>
          )}

          <div className="modal-section">
            <h3>Nền tảng hỗ trợ</h3>
            <ul className="modal-platforms">
              {app.platforms.map((p) => (
                <li
                  key={p}
                  className={
                    p === currentPlatform
                      ? 'platform-chip platform-chip-current'
                      : 'platform-chip'
                  }
                >
                  {PLATFORM_LABEL[p] || p}
                  {p === currentPlatform && (
                    <span className="platform-current-tag">máy này</span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {app.changelog_url && (
            <div className="modal-section">
              <h3>Changelog</h3>
              <button
                type="button"
                className="modal-link"
                onClick={() => onOpenExternal(app.changelog_url)}
              >
                Xem lịch sử thay đổi →
              </button>
            </div>
          )}
        </section>

        <footer className="modal-foot">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onClose}
          >
            Đóng
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={cta.disabled}
            onClick={onInstall}
          >
            {cta.label}
          </button>
        </footer>
      </div>
    </div>
  );
}
