import { useEffect, useMemo, useState } from 'react';
import {
  mergeRegistry,
  filterByPlatform,
  statusLabel,
  loginRequiredLabel,
  formatSize,
  type AppForUi,
  type Platform,
} from '@trishteam/core/apps';
import { SEED_REGISTRY } from './apps-seed.js';
import { APP_META } from './apps-meta.js';
import { INSTALL_CANDIDATES } from './install-candidates.js';
import type { InstallDetection, InstallProbe } from './install-types.js';
import { resolveCta } from './cta.js';
import {
  getSysInfo,
  getAppVersion,
  openExternal,
  detectInstall,
  launchPath,
  type SysInfo,
  FALLBACK_SYS_INFO,
} from './tauri-bridge.js';
import { LAUNCHER_ICON, iconFor } from './icons/index.js';
import { AppDetailModal } from './components/AppDetailModal.js';

/**
 * Chuyển `sysinfo.arch` (x86_64, aarch64, …) sang Platform của core.
 * Launcher chỉ chạy trên desktop nên không cần web/zalo_mini.
 */
function detectPlatform(sys: SysInfo): Platform {
  const os = sys.os.toLowerCase();
  const arch = sys.arch.toLowerCase();

  if (os.includes('windows')) {
    return arch === 'aarch64' ? 'windows_arm64' : 'windows_x64';
  }
  if (os.includes('mac') || os.includes('darwin')) {
    return arch === 'aarch64' ? 'macos_arm64' : 'macos_x64';
  }
  return 'linux_x64';
}

/**
 * Build probe list cho Rust detect_install — chỉ gửi những app có
 * candidate cho platform hiện tại. App không có candidate coi như
 * not_installed luôn (coming_soon chưa biết install path).
 */
function buildProbes(apps: AppForUi[], platform: Platform): InstallProbe[] {
  const probes: InstallProbe[] = [];
  for (const app of apps) {
    const candidates = INSTALL_CANDIDATES[app.id]?.[platform];
    if (candidates && candidates.length > 0) {
      probes.push({ id: app.id, candidates });
    }
  }
  return probes;
}

export function App(): JSX.Element {
  const [sys, setSys] = useState<SysInfo>(FALLBACK_SYS_INFO);
  const [version, setVersion] = useState('dev');
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [installMap, setInstallMap] = useState<Map<string, InstallDetection>>(
    () => new Map(),
  );

  useEffect(() => {
    void getSysInfo().then(setSys);
    void getAppVersion().then(setVersion);
  }, []);

  const platform = useMemo(() => detectPlatform(sys), [sys]);

  /**
   * Merge registry entry với APP_META (features/accent/release_date) để
   * modal hiển thị full metadata. Phase 14.5.5.a dùng `{}` → features
   * array rỗng; Phase 14.5.5.b wire META thật vào.
   */
  const apps: AppForUi[] = useMemo(
    () => mergeRegistry(SEED_REGISTRY, APP_META),
    [],
  );

  const compatApps = useMemo(
    () => filterByPlatform(apps, platform),
    [apps, platform],
  );

  /**
   * Phase 14.5.5.c — probe install state khi compat list thay đổi (sau
   * khi sys detect xong). Tauri chưa ready ở lần render đầu →
   * detectInstall trả hết not_installed (fallback browser mode), Rust
   * call thật khi platform detection hoàn tất.
   */
  useEffect(() => {
    const probes = buildProbes(compatApps, platform);
    if (probes.length === 0) return;
    let cancelled = false;
    void detectInstall(probes).then((results) => {
      if (cancelled) return;
      const map = new Map<string, InstallDetection>();
      for (const r of results) map.set(r.id, r);
      setInstallMap(map);
    });
    return () => {
      cancelled = true;
    };
  }, [compatApps, platform]);

  const selectedApp = useMemo(
    () => (selectedAppId ? apps.find((a) => a.id === selectedAppId) : null),
    [apps, selectedAppId],
  );

  const memGb = sys.total_memory_bytes
    ? (sys.total_memory_bytes / 1024 ** 3).toFixed(1)
    : '—';

  /**
   * Primary CTA handler — 3 state:
   * 1. Installed có path → launchPath (mở app local)
   * 2. Released + có download URL → openExternal (tải về)
   * 3. Coming soon hoặc no download → disabled ở layer button (không vào đây)
   * Fallback: nếu launch fail (vd app bị xoá giữa chừng) thì openExternal.
   */
  const handleInstall = (app: AppForUi): void => {
    const detect = installMap.get(app.id);
    if (detect && detect.state === 'installed' && detect.path) {
      void launchPath(detect.path).catch((err) => {
        console.warn('[trishlauncher] launch failed, fallback download:', err);
        const target = app.download[platform];
        if (target?.url) void openExternal(target.url);
      });
      return;
    }
    const target = app.download[platform];
    if (target?.url) {
      void openExternal(target.url);
    }
  };

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <img
            className="brand-logo"
            src={LAUNCHER_ICON}
            alt=""
            aria-hidden
            width={40}
            height={40}
          />
          <div>
            <strong>TrishLauncher</strong>
            <div className="sub">{SEED_REGISTRY.ecosystem.tagline}</div>
          </div>
        </div>
        <button
          className="btn btn-ghost"
          onClick={() => void openExternal('https://trishteam.io.vn')}
        >
          Mở website
        </button>
      </header>

      <section className="sysbar">
        <span>
          <b>{sys.os}</b> {sys.os_version}
        </span>
        <span className="sep">·</span>
        <span>{sys.arch}</span>
        <span className="sep">·</span>
        <span>{sys.cpu_count || '—'} CPU</span>
        <span className="sep">·</span>
        <span>{memGb} GB RAM</span>
        <span className="spacer" />
        <span className="muted">Launcher v{version}</span>
      </section>

      <main className="grid">
        {compatApps.length === 0 && (
          <div className="empty">
            Chưa có ứng dụng nào tương thích với máy này ({platform}).
          </div>
        )}
        {compatApps.map((app) => (
          <AppCard
            key={app.id}
            app={app}
            platform={platform}
            detect={installMap.get(app.id) ?? null}
            onInstall={() => handleInstall(app)}
            onOpenDetail={() => setSelectedAppId(app.id)}
          />
        ))}
      </main>

      <footer className="foot">
        <span>{apps.length} app trong ecosystem</span>
        <span className="muted">
          © 2026 TrishTEAM · {SEED_REGISTRY.ecosystem.website}
        </span>
      </footer>

      {selectedApp && (
        <AppDetailModal
          app={selectedApp}
          currentPlatform={platform}
          detect={installMap.get(selectedApp.id) ?? null}
          onClose={() => setSelectedAppId(null)}
          onInstall={() => {
            handleInstall(selectedApp);
            setSelectedAppId(null);
          }}
          onOpenExternal={(url) => {
            void openExternal(url);
          }}
        />
      )}
    </div>
  );
}

interface AppCardProps {
  app: AppForUi;
  platform: Platform;
  detect: InstallDetection | null;
  onInstall: () => void;
  onOpenDetail: () => void;
}

function AppCard({
  app,
  platform,
  detect,
  onInstall,
  onOpenDetail,
}: AppCardProps): JSX.Element {
  const iconUrl = iconFor(app.id);
  const cta = resolveCta(app, platform, detect);
  const isInstalled = detect?.state === 'installed';

  return (
    <article className={`card ${isInstalled ? 'card-installed' : ''}`}>
      <button
        type="button"
        className="card-head-btn"
        onClick={onOpenDetail}
        aria-label={`Xem chi tiết ${app.name}`}
      >
        <div className="card-head">
          {iconUrl ? (
            <img
              className="app-icon"
              src={iconUrl}
              alt=""
              aria-hidden
              width={48}
              height={48}
            />
          ) : (
            <div className="app-icon app-icon-fallback" aria-hidden>
              {app.name.charAt(0)}
            </div>
          )}
          <div className="card-head-text">
            <h3>{app.name}</h3>
            <div className="card-head-badges">
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
        </div>
        <p className="tagline">{app.tagline}</p>
      </button>
      <dl className="meta">
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
      </dl>
      <div className="card-actions">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={onOpenDetail}
        >
          Chi tiết
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={cta.disabled}
          onClick={onInstall}
        >
          {cta.label}
        </button>
      </div>
    </article>
  );
}
