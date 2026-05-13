import { useEffect, useMemo, useState } from 'react';
import {
  mergeRegistry,
  filterByPlatform,
  statusLabel,
  loginRequiredLabel,
  loginRequiredBadge,
  keyTypeBadge,
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
  updateTrayQuickLaunch,
  setMinimizeToTrayEnabled,
  // Phase 39.5 — Auto-install
  downloadInstaller,
  runInstaller,
  listenDownloadProgress,
  type SysInfo,
  type QuickLaunchItem,
  type DownloadProgressEvent,
  FALLBACK_SYS_INFO,
} from './tauri-bridge.js';
import { LAUNCHER_ICON, iconFor } from './icons/index.js';
import { AppDetailModal } from './components/AppDetailModal.js';
import { SettingsModal } from './components/SettingsModal.js';
import { QuickSearch } from './components/QuickSearch.js';
import { AccountButton } from './components/AccountButton.js';
import { trackOpen, compareByUsage, getAllStats } from './app-stats.js';
import {
  loadSettings,
  saveSettings,
  applyTheme,
  type Settings,
} from './settings.js';
import { makeT } from './i18n/index.js';
import { loadRegistry, type RegistryLoadResult } from './registry-loader.js';
import { startScheduler, setLastFetchMs } from './update-scheduler.js';

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

  // Phase 20.3 — manual update flow state
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Phase 39.1 — Quick search Spotlight (Ctrl+K)
  const [quickSearchOpen, setQuickSearchOpen] = useState(false);

  // Phase 39.5 — Auto-download state per app
  const [downloadStates, setDownloadStates] = useState<
    Map<string, { phase: string; percent: number }>
  >(() => new Map());

  // Phase 14.5.5.e — Settings state (theme/language/registry/autoUpdate).
  // Lazy-init từ localStorage để tránh flash theme sai ở render đầu.
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const tr = useMemo(() => makeT(settings.language), [settings.language]);

  // Phase 14.6.a — Registry state (seed ban đầu, fetch từ remote nếu
  // settings.registryUrl set). null trong "error" nghĩa là chưa fetch
  // hoặc đã OK. source='seed' khi URL rỗng hoặc fetch fail.
  const [registryResult, setRegistryResult] = useState<RegistryLoadResult>(
    () => ({
      registry: SEED_REGISTRY,
      source: 'seed',
      fetchedAt: null,
      error: null,
    }),
  );

  // Apply theme mỗi khi settings.theme đổi (bao gồm lần mount đầu).
  useEffect(() => {
    applyTheme(settings.theme);
  }, [settings.theme]);

  // Phase 39.1 — Hotkey Ctrl+K / Cmd+K → mở Quick search Spotlight
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setQuickSearchOpen((v) => !v);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Phase 39.5 — Subscribe download progress events
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    void listenDownloadProgress((evt: DownloadProgressEvent) => {
      const percent =
        evt.total > 0 ? Math.round((evt.downloaded / evt.total) * 100) : 0;
      setDownloadStates((prev) => {
        const next = new Map(prev);
        if (evt.phase === 'done' || evt.phase === 'error') {
          // Show 100% rồi xóa sau 2s
          next.set(evt.app_id, { phase: evt.phase, percent: 100 });
          setTimeout(() => {
            setDownloadStates((p) => {
              const m = new Map(p);
              m.delete(evt.app_id);
              return m;
            });
          }, 2000);
        } else {
          next.set(evt.app_id, { phase: evt.phase, percent });
        }
        return next;
      });
      // Toast updates
      if (evt.phase === 'start') {
        setToast(`📥 Bắt đầu tải ${evt.app_id}...`);
      } else if (evt.phase === 'downloading' && percent > 0) {
        setToast(`📥 Đang tải ${evt.app_id}: ${percent}%`);
      } else if (evt.phase === 'done') {
        setToast(`✅ Tải xong ${evt.app_id} — đang mở installer...`);
        setTimeout(() => setToast(null), 3000);
      } else if (evt.phase === 'error') {
        setToast(`❌ Lỗi tải ${evt.app_id}: ${evt.error}`);
        setTimeout(() => setToast(null), 5000);
      }
    }).then((fn) => {
      unlisten = fn;
    });
    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  // Load registry khi mount + mỗi khi registryUrl thay đổi (user Save
  // Settings với URL mới → fetch lại ngay). Phase 14.6.b — ghi
  // last_fetch_ms khi remote fetch thành công để scheduler biết skip.
  useEffect(() => {
    let cancelled = false;
    void loadRegistry(settings.registryUrl).then((result) => {
      if (cancelled) return;
      setRegistryResult(result);
      if (result.source === 'remote' && result.fetchedAt) {
        setLastFetchMs(result.fetchedAt);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [settings.registryUrl]);

  // Phase 14.6.b — Auto-update scheduler. Off = no-op. Khi overdue →
  // refetch + cập nhật state + ghi last_fetch_ms. Cleanup khi interval
  // config đổi hoặc component unmount để tránh double schedule.
  // Phase 14.7.g — Luôn schedule (dùng DEFAULT_REGISTRY_URL nếu user
  // không override). startScheduler('off') trả no-op nên không cần
  // early return.
  useEffect(() => {
    const cleanup = startScheduler(settings.autoUpdateInterval, () => {
      void loadRegistry(settings.registryUrl).then((result) => {
        setRegistryResult(result);
        if (result.source === 'remote' && result.fetchedAt) {
          setLastFetchMs(result.fetchedAt);
        }
      });
    });
    return cleanup;
  }, [settings.autoUpdateInterval, settings.registryUrl]);

  useEffect(() => {
    void getSysInfo().then(setSys);
    void getAppVersion().then(setVersion);
  }, []);

  // Phase 20.2 — Push minimize-to-tray flag xuống Rust mỗi khi user lưu
  // setting. Rust on_window_event đọc flag để quyết định prevent_close.
  useEffect(() => {
    void setMinimizeToTrayEnabled(settings.minimizeToTray);
  }, [settings.minimizeToTray]);

  const platform = useMemo(() => detectPlatform(sys), [sys]);

  /**
   * Merge registry entry với APP_META (features/accent/release_date) để
   * modal hiển thị full metadata. Phase 14.5.5.a dùng `{}` → features
   * array rỗng; Phase 14.5.5.b wire META thật vào.
   * Phase 14.6.a — registry có thể đến từ seed hoặc remote fetch.
   */
  const apps: AppForUi[] = useMemo(
    () => mergeRegistry(registryResult.registry, APP_META),
    [registryResult.registry],
  );

  // Phase 20.2 — Lọc khỏi grid:
  //   - trishlauncher: launcher không show chính nó
  //   - status='deprecated': các app đã gộp vào TrishLibrary (TrishNote/Image/
  //     Search/Type) → user không cần thấy entry riêng. Registry vẫn giữ entry
  //     deprecated cho web /downloads và backward compat, launcher ẩn đi.
  const compatApps = useMemo(() => {
    const filtered = filterByPlatform(apps, platform).filter(
      (a) => a.id !== 'trishlauncher' && a.status !== 'deprecated',
    );
    // Phase 39.3 — Sort theo most-used: app dùng nhiều xuất hiện đầu, app
    // chưa từng mở giữ thứ tự gốc theo registry.
    const stats = getAllStats();
    return [...filtered].sort((a, b) => compareByUsage(a, b, stats));
  }, [apps, platform]);

  // Phase 14.7.h — Footer hiển thị tiến độ "x/y phần mềm đã phát hành".
  // Phase 20.2 — Đếm app "user có thể tải" = released hoặc scheduled đã
  // qua release_at. Không tính 'coming_soon' (chưa code) và 'deprecated'
  // (đã gộp). Cũng loại trishlauncher (không count chính mình).
  const releasedCount = useMemo(() => {
    const now = Date.now();
    return apps.filter((a) => {
      if (a.id === 'trishlauncher') return false;
      if (a.status === 'released') return true;
      if (a.status === 'scheduled' && a.release_at) {
        return new Date(a.release_at).getTime() <= now;
      }
      return false;
    }).length;
  }, [apps]);

  // Total apps tracked (loại deprecated + trishlauncher khỏi denominator).
  const totalApps = useMemo(
    () =>
      apps.filter((a) => a.status !== 'deprecated' && a.id !== 'trishlauncher')
        .length,
    [apps],
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

      // Phase 14.5.5.d — đẩy danh sách app đã cài lên tray để submenu
      // Quick-launch có nội dung. Label dùng tên app từ compatApps
      // (merge APP_META + registry). Chỉ push item có path thật để Rust
      // không phải re-verify.
      const nameById = new Map(compatApps.map((a) => [a.id, a.name]));
      const quickItems: QuickLaunchItem[] = results
        .filter((r) => r.state === 'installed' && r.path)
        .map((r) => ({
          id: r.id,
          label: nameById.get(r.id) ?? r.id,
          path: r.path as string,
        }));
      void updateTrayQuickLaunch(quickItems);
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
    // Phase 38 — Check needsUpdate trước launch. Nếu installed_version < app.version
    // → button hiện "Cập nhật" → bypass launch, chạy download installer mới.
    const cta = resolveCta(app, platform, detect ?? null);
    const needsUpdate = cta.needsUpdate === true;

    if (
      detect &&
      detect.state === 'installed' &&
      detect.path &&
      !needsUpdate
    ) {
      // Phase 39.3 — Track app open stats trước khi launch
      trackOpen(app.id);
      void launchPath(detect.path).catch((err) => {
        console.warn('[trishlauncher] launch failed:', err);
        setToast(`Không mở được ${app.name}: ${err}`);
        setTimeout(() => setToast(null), 4000);
      });
      return;
    }
    // needsUpdate hoặc not_installed → đi tiếp xuống download flow
    const target = app.download[platform];
    if (!target?.url) return;

    // Phase 41.2 — External app: mở trang chủ trong browser thay vì install qua Tauri.
    // Adobe/Autodesk/OBS… không có installer mình control được.
    if (app.category === 'external') {
      const homepage = app.homepage_url ?? target.url;
      setToast(`🌐 Mở ${app.name} trên trình duyệt...`);
      void openExternal(homepage);
      setTimeout(() => setToast(null), 3000);
      return;
    }

    // Phase 39.5 — Auto-download + auto-spawn installer
    // Đang tải rồi thì bỏ qua click thứ 2
    if (downloadStates.has(app.id)) {
      setToast(`${app.name} đang được tải, vui lòng đợi...`);
      setTimeout(() => setToast(null), 3000);
      return;
    }

    void (async () => {
      try {
        const path = await downloadInstaller(target.url, app.id);
        // Sau khi download xong → spawn installer (Phase A: NSIS UI sẽ hiện)
        await runInstaller(path);
        // Re-detect sau 30s để installer kịp ghi file
        setTimeout(() => {
          void (async () => {
            const platformApps = filterByPlatform(apps, platform);
            const probes = buildProbes(platformApps, platform);
            const fresh = await detectInstall(probes);
            const map = new Map<string, InstallDetection>();
            for (const d of fresh) map.set(d.id, d);
            setInstallMap(map);
            setToast(`✅ ${app.name} đã sẵn sàng — bấm Mở để chạy`);
            setTimeout(() => setToast(null), 5000);
          })();
        }, 30_000);
      } catch (err) {
        console.error('[trishlauncher] install flow failed:', err);
        setToast(
          `Lỗi cài ${app.name}: ${err instanceof Error ? err.message : err}. Mở trình duyệt fallback...`,
        );
        // Fallback: mở browser nếu Tauri command fail
        void openExternal(target.url);
        setTimeout(() => setToast(null), 5000);
      }
    })();
  };

  /**
   * Phase 20.3 — Secondary action cho card đã cài: mở download URL để
   * user tải bản mới (NSIS ghi đè bản cũ tự động).
   */
  const handleUpdate = (app: AppForUi): void => {
    const target = app.download[platform];
    if (target?.url) {
      void openExternal(target.url);
      setToast(`Đang mở trình duyệt để tải bản mới của ${app.name}…`);
      setTimeout(() => setToast(null), 4000);
    }
  };

  /**
   * Phase 20.3 — Force refetch registry (bỏ cache 60s từ API). Hiển thị
   * spinner trên button + toast feedback. Nếu fail → fallback chain trong
   * loadRegistry tự xử (live API → static → seed).
   */
  const handleCheckUpdates = async (): Promise<void> => {
    if (refreshing) return;
    setRefreshing(true);
    setToast(null);
    try {
      // Append cache-buster query để Vercel CDN không trả response cache
      const url = settings.registryUrl
        ? settings.registryUrl
        : `https://www.trishteam.io.vn/api/apps-registry?t=${Date.now()}`;
      const result = await loadRegistry(url);
      setRegistryResult(result);
      if (result.source === 'remote' && result.fetchedAt) {
        setLastFetchMs(result.fetchedAt);
      }
      if (result.error) {
        setToast(`⚠ Không tải được registry mới: ${result.error}`);
      } else {
        setToast(
          `✓ Đã cập nhật danh sách. Bấm "Cập nhật" trên card đã cài để tải bản mới.`,
        );
      }
    } catch (err) {
      setToast(
        `⚠ Lỗi: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setRefreshing(false);
      setTimeout(() => setToast(null), 5000);
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
            <div className="sub">
              {registryResult.registry.ecosystem.tagline}
            </div>
          </div>
        </div>
        <div className="topbar-actions">
          <button
            className="btn btn-ghost"
            onClick={() => {
              const cur =
                settings.theme === 'system'
                  ? window.matchMedia('(prefers-color-scheme: dark)').matches
                    ? 'dark'
                    : 'light'
                  : settings.theme;
              const next: 'light' | 'dark' = cur === 'dark' ? 'light' : 'dark';
              const upd = { ...settings, theme: next };
              applyTheme(next);
              setSettings(upd);
              saveSettings(upd);
            }}
            title={
              settings.theme === 'dark'
                ? 'Chuyển sang Light'
                : 'Chuyển sang Dark'
            }
            aria-label="Toggle theme"
            style={{ padding: '8px 12px', fontSize: 16 }}
          >
            {(settings.theme === 'system'
              ? window.matchMedia('(prefers-color-scheme: dark)').matches
                ? 'dark'
                : 'light'
              : settings.theme) === 'dark'
              ? '☀'
              : '🌙'}
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => void handleCheckUpdates()}
            disabled={refreshing}
            title={tr('topbar.check_updates_title')}
          >
            {refreshing ? '⏳ ' : '🔄 '}
            {tr('topbar.check_updates')}
          </button>
          <AccountButton />
          <button
            className="btn btn-ghost"
            onClick={() => setSettingsOpen(true)}
          >
            {tr('topbar.settings')}
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => void openExternal('https://trishteam.io.vn')}
          >
            {tr('topbar.website')}
          </button>
        </div>
      </header>

      {toast && <div className="toast">{toast}</div>}

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
        {registryResult.source === 'remote' && (
          <span
            className="sysbar-pill sysbar-pill-ok"
            title={`Registry fetched at ${new Date(
              registryResult.fetchedAt ?? 0,
            ).toLocaleString()}`}
          >
            ● {tr('sysbar.connected')}
          </span>
        )}
        {registryResult.error && (
          <span
            className="sysbar-pill sysbar-pill-warn"
            title={`Registry fetch fail: ${registryResult.error}`}
          >
            ⚠ {tr('sysbar.offline')}
          </span>
        )}
        <span className="sep">·</span>
        <span className="muted">Launcher v{version}</span>
      </section>

      <main className="grid">
        {compatApps.length === 0 && (
          <div className="empty">
            {tr('grid.empty')} ({platform}).
          </div>
        )}
        {compatApps.map((app) => (
          <AppCard
            key={app.id}
            app={app}
            platform={platform}
            detect={installMap.get(app.id) ?? null}
            onInstall={() => handleInstall(app)}
            onUpdate={() => handleUpdate(app)}
            onOpenDetail={() => setSelectedAppId(app.id)}
          />
        ))}
      </main>

      {/* Phase 20.2 — Bỏ nút "Đăng nhập TrishTEAM" footer. Launcher chỉ là
          hub khám phá + cài đặt app, không có Firebase Auth. App nào cần
          đăng nhập (Library/Design) sẽ tự handle login bên trong app đó. */}
      <footer className="foot">
        <span>
          {releasedCount}/{totalApps} {tr('footer.apps_released')}
        </span>
        <span className="muted">
          © 2026 TrishTEAM · {registryResult.registry.ecosystem.website}
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

      {/* Phase 39.1 — Quick search Spotlight (Ctrl+K) */}
      <QuickSearch
        apps={compatApps}
        installMap={installMap}
        open={quickSearchOpen}
        onClose={() => setQuickSearchOpen(false)}
        onLaunch={(app) => handleInstall(app)}
        onSelectApp={(appId) => setSelectedAppId(appId)}
      />

      {settingsOpen && (
        <SettingsModal
          initial={settings}
          onClose={() => setSettingsOpen(false)}
          onSave={(next) => {
            // Apply theme ngay trước khi setState để tránh flash 1 frame.
            applyTheme(next.theme);
            setSettings(next);
            saveSettings(next);
            setSettingsOpen(false);
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
  onUpdate: () => void;
  onOpenDetail: () => void;
}

function AppCard({
  app,
  platform,
  detect,
  onInstall,
  onUpdate,
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
              {/* Phase 41.2 — Category badge (external/utility chỉ; ecosystem ko cần) */}
              {app.category === 'external' && (
                <span className="badge badge-login badge-login-blue" title={app.publisher ? `Bên ngoài · ${app.publisher}` : 'App đối tác / bên ngoài'}>
                  🔵 Đối tác
                </span>
              )}
              {app.category === 'utility' && (
                <span className="badge badge-login badge-login-yellow" title="Tiện ích nhỏ">
                  🟡 Tiện ích
                </span>
              )}
              {(() => {
                // Phase 39.4 — Nếu app yêu cầu key → KHÔNG hiển thị badge "Miễn phí"
                // (vì user phải xin key admin, không phải hoàn toàn free).
                // keyTypeBadge bên dưới sẽ hiển thị badge key thay thế.
                if (app.requires_key) return null;
                const b = loginRequiredBadge(app.login_required);
                return (
                  <span
                    className={`badge badge-login badge-login-${b.color}`}
                    title={loginRequiredLabel(app.login_required)}
                  >
                    {b.emoji} {b.label}
                  </span>
                );
              })()}
              {(() => {
                // Phase 36.1 — Badge key activation type
                const b = keyTypeBadge(app.requires_key, app.key_type);
                if (!app.requires_key) return null; // không hiện cho free
                return (
                  <span
                    className={`badge badge-login badge-login-${b.color}`}
                    title={
                      app.key_type === 'standalone'
                        ? 'Cần kích hoạt key 16 ký tự — bind vào máy này (không cần đăng nhập tài khoản)'
                        : 'Cần đăng nhập + kích hoạt key 16 ký tự — bind vào tài khoản TrishTEAM'
                    }
                  >
                    {b.emoji} {b.label}
                  </span>
                );
              })()}
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
        {/* Phase 20.3 — Card đã cài có button "Cập nhật" cạnh "Mở":
            user click → mở download URL trình duyệt → tải bản mới về →
            installer NSIS ghi đè bản cũ. Card chưa cài thì chỉ có button
            chính (Tải về / Còn N ngày / etc). */}
        {isInstalled && Boolean(app.download[platform]?.url) && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onUpdate}
            title="Tải bản mới nhất từ website (NSIS sẽ ghi đè bản cũ)"
          >
            🔄 Cập nhật
          </button>
        )}
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
