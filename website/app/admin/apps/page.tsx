'use client';

/**
 * /admin/apps — Phase 19.22.
 *
 * Admin CRUD app metadata trong Firestore /apps_meta/{appId}.
 *
 * Workflow:
 *   1. Lần đầu: bấm "Nạp tất cả từ registry" → import 10 app từ apps-registry.json
 *   2. Sửa từng app: click "Sửa" → modal form (tagline, version, release_at,
 *      status, features, download URL, sha256, changelog_url)
 *   3. /downloads page và popup app trên dashboard tự đọc Firestore
 *
 * Trang user (/downloads, popup) sẽ ưu tiên data Firestore, fallback registry.json.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import {
  Calendar,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { getIdToken } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { useConfirm } from '@/components/confirm-modal';

type Status = 'released' | 'scheduled' | 'coming_soon' | 'beta' | 'deprecated';
type LoginType = 'none' | 'trial' | 'user' | 'admin' | 'paid' | 'dev';

interface AppMeta {
  id: string;
  name: string;
  tagline: string;
  version: string;
  size_bytes: number;
  status: Status;
  release_at: string | null;
  login_required: LoginType;
  platforms: string[];
  changelog_url: string;
  download: Record<string, { url?: string; sha256?: string; installer_args?: string[] }>;
  features: string[];
  accent: string;
  icon_fallback: string;
  logo_path: string;
  screenshots: string[];
}

const STATUS_COLOR: Record<Status, { bg: string; fg: string; label: string }> = {
  released: { bg: 'rgba(16,185,129,0.15)', fg: '#059669', label: 'Đã phát hành' },
  scheduled: { bg: 'rgba(245,158,11,0.15)', fg: '#B45309', label: 'Đặt lịch' },
  coming_soon: { bg: 'rgba(160,152,144,0.15)', fg: '#6B7280', label: 'Sắp ra mắt' },
  beta: { bg: 'rgba(168,85,247,0.15)', fg: '#7C3AED', label: 'Beta' },
  deprecated: { bg: 'rgba(239,68,68,0.15)', fg: '#B91C1C', label: 'Đã gộp' },
};

export default function AdminAppsPage() {
  const [ConfirmDialog, askConfirm] = useConfirm();
  const [apps, setApps] = useState<AppMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<AppMeta | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ text: string; tone: 'ok' | 'err' } | null>(null);

  function flash(tone: 'ok' | 'err', text: string) {
    setToast({ text, tone });
    setTimeout(() => setToast(null), 3500);
  }

  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(
      collection(db, 'apps_meta'),
      (snap) => {
        const list: AppMeta[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            name: (data.name as string) ?? d.id,
            tagline: (data.tagline as string) ?? '',
            version: (data.version as string) ?? '1.0.0',
            size_bytes: (data.size_bytes as number) ?? 0,
            status: ((data.status as string) ?? 'coming_soon') as Status,
            release_at: (data.release_at as string) ?? null,
            login_required: ((data.login_required as string) ?? 'none') as LoginType,
            platforms: (data.platforms as string[]) ?? ['windows_x64'],
            changelog_url: (data.changelog_url as string) ?? '',
            download: (data.download as Record<string, { url?: string; sha256?: string }>) ?? {},
            features: (data.features as string[]) ?? [],
            accent: (data.accent as string) ?? '#667EEA',
            icon_fallback: (data.icon_fallback as string) ?? 'Package',
            logo_path: (data.logo_path as string) ?? '',
            screenshots: (data.screenshots as string[]) ?? [],
          };
        });
        list.sort((a, b) => a.id.localeCompare(b.id));
        setApps(list);
        setLoading(false);
      },
      (err) => {
        console.warn('[admin/apps] subscribe fail:', err);
        flash('err', `Lỗi: ${err.message}`);
        setLoading(false);
      },
    );
    return () => unsub();
  }, []);

  async function seedAll(overwrite: boolean) {
    if (!auth?.currentUser) return;
    if (overwrite) {
      const ok = await askConfirm({
        title: 'Reseed tất cả app',
        message: 'Ghi đè TẤT CẢ app metadata bằng data từ apps-registry.json. Mọi chỉnh sửa thủ công sẽ mất.',
        okLabel: 'Ghi đè',
        danger: true,
      });
      if (!ok) return;
    }
    setBusy(true);
    try {
      const idToken = await getIdToken(auth.currentUser);
      const res = await fetch('/api/admin/seed-apps', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ overwrite }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        created?: number;
        skipped?: number;
        updated?: number;
        error?: string;
      };
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      flash(
        'ok',
        `Nạp xong! Thêm ${body.created} mới · Cập nhật ${body.updated} · Bỏ qua ${body.skipped}`,
      );
    } catch (e) {
      flash('err', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function saveApp(payload: AppMeta) {
    if (!db) return;
    setBusy(true);
    try {
      await setDoc(
        doc(db, 'apps_meta', payload.id),
        {
          ...payload,
          _updated_at: Date.now(),
          _server_updated: serverTimestamp(),
        },
        { merge: true },
      );
      flash('ok', `Đã lưu ${payload.name}.`);
      setEditing(null);
    } catch (e) {
      flash('err', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function deleteApp(app: AppMeta) {
    const ok = await askConfirm({
      title: 'Xóa app metadata',
      message: `Xóa metadata Firestore của "${app.name}"? (Vẫn còn data trong apps-registry.json — có thể nạp lại).`,
      okLabel: 'Xóa',
      danger: true,
    });
    if (!ok || !db) return;
    setBusy(true);
    try {
      await deleteDoc(doc(db, 'apps_meta', app.id));
      flash('ok', `Đã xóa ${app.name} khỏi Firestore.`);
    } catch (e) {
      flash('err', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <ConfirmDialog />

      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
            <Package size={22} /> Apps Desktop
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Sửa thông tin {apps.length} app: tagline · version · ngày phát hành · features · link tải. Sync real-time với /downloads + popup dashboard.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void seedAll(false)}
            disabled={busy}
            className="inline-flex items-center gap-1.5 h-10 px-3 rounded-md text-xs font-bold disabled:opacity-50"
            style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent-primary)' }}
            title="Chỉ thêm app chưa có. Giữ nguyên app đã chỉnh sửa."
          >
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
            Nạp app mới (giữ bản đã sửa)
          </button>
          <button
            onClick={() => void seedAll(true)}
            disabled={busy}
            className="inline-flex items-center gap-1.5 h-10 px-3 rounded-md text-xs font-bold disabled:opacity-50"
            style={{
              background: 'rgba(239,68,68,0.08)',
              color: '#B91C1C',
              border: '1px solid rgba(239,68,68,0.25)',
            }}
            title="Ghi đè tất cả từ registry — mất chỉnh sửa thủ công."
          >
            {busy ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            Reset từ registry
          </button>
        </div>
      </header>

      {toast ? (
        <div
          className="px-3 py-2 rounded-md text-sm break-words"
          style={{
            background: toast.tone === 'ok' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
            color: toast.tone === 'ok' ? '#059669' : '#B91C1C',
            border: `1px solid ${toast.tone === 'ok' ? '#10B98155' : '#EF444455'}`,
          }}
        >
          {toast.tone === 'ok' ? <CheckCircle2 size={14} className="inline mr-1.5" /> : <X size={14} className="inline mr-1.5" />}
          {toast.text}
        </div>
      ) : null}

      {loading ? (
        <div className="py-10 text-center" style={{ color: 'var(--color-text-muted)' }}>
          <Loader2 size={20} className="animate-spin inline mr-2" /> Đang tải...
        </div>
      ) : apps.length === 0 ? (
        <div
          className="rounded-xl border p-10 text-center"
          style={{
            background: 'var(--color-surface-card)',
            borderColor: 'var(--color-border-default)',
          }}
        >
          <Package size={32} className="inline mb-3 opacity-40" />
          <p className="text-sm mb-3" style={{ color: 'var(--color-text-secondary)' }}>
            Chưa có app metadata. Bấm <strong>"Nạp app mới"</strong> để import từ apps-registry.json.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {apps.map((app) => {
            const sc = STATUS_COLOR[app.status] ?? STATUS_COLOR.coming_soon;
            return (
              <div
                key={app.id}
                className="rounded-lg border p-4"
                style={{
                  background: 'var(--color-surface-primary)',
                  borderColor: 'var(--color-border-subtle)',
                  borderLeftWidth: 3,
                  borderLeftColor: app.accent,
                }}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="w-9 h-9 rounded inline-flex items-center justify-center shrink-0 overflow-hidden"
                      style={{
                        background: 'rgba(255,255,255,0.88)',
                        border: `1px solid ${app.accent}44`,
                      }}
                    >
                      {app.logo_path ? (
                        <img src={app.logo_path} alt="" className="w-7 h-7 object-contain" />
                      ) : (
                        <Package size={18} style={{ color: app.accent }} />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold truncate" style={{ color: 'var(--color-text-primary)' }}>
                        {app.name}
                      </h3>
                      <p className="text-[11px] font-mono" style={{ color: 'var(--color-text-muted)' }}>
                        {app.id} · v{app.version}
                      </p>
                    </div>
                  </div>
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded shrink-0"
                    style={{ background: sc.bg, color: sc.fg }}
                  >
                    {sc.label}
                  </span>
                </div>

                <p className="text-xs mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                  {app.tagline || '(chưa có tagline)'}
                </p>

                <div className="flex items-center gap-3 text-[11px] mb-3" style={{ color: 'var(--color-text-muted)' }}>
                  {app.release_at ? (
                    <span className="inline-flex items-center gap-1">
                      <Calendar size={11} />
                      {new Date(app.release_at).toLocaleDateString('vi-VN')}
                    </span>
                  ) : null}
                  <span>{app.features.length} features</span>
                  <span>{app.platforms.length} platform</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setEditing(app)}
                    className="inline-flex items-center gap-1 px-3 h-8 rounded text-xs font-bold transition-opacity hover:opacity-80"
                    style={{
                      background: 'var(--color-accent-gradient)',
                      color: '#fff',
                    }}
                  >
                    <Pencil size={11} /> Sửa
                  </button>
                  <a
                    href={`/downloads#${app.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-3 h-8 rounded text-xs font-medium"
                    style={{
                      background: 'var(--color-surface-muted)',
                      color: 'var(--color-text-secondary)',
                      border: '1px solid var(--color-border-subtle)',
                    }}
                  >
                    <ExternalLink size={11} /> Xem trang
                  </a>
                  <button
                    onClick={() => void deleteApp(app)}
                    className="inline-flex items-center justify-center w-8 h-8 rounded transition-opacity hover:opacity-80"
                    style={{
                      background: 'rgba(239,68,68,0.08)',
                      color: '#B91C1C',
                      border: '1px solid rgba(239,68,68,0.25)',
                    }}
                    title="Xóa khỏi Firestore"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing ? (
        <AppEditModal
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={saveApp}
          busy={busy}
        />
      ) : null}
    </div>
  );
}

// ============================================================
// Modal edit
// ============================================================
function AppEditModal({
  initial,
  onClose,
  onSave,
  busy,
}: {
  initial: AppMeta;
  onClose: () => void;
  onSave: (payload: AppMeta) => void;
  busy: boolean;
}) {
  const [form, setForm] = useState<AppMeta>(initial);

  function update<K extends keyof AppMeta>(key: K, value: AppMeta[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function updateDownload(field: 'url' | 'sha256', value: string) {
    setForm((f) => ({
      ...f,
      download: {
        ...f.download,
        windows_x64: {
          ...(f.download.windows_x64 ?? {}),
          [field]: value,
        },
      },
    }));
  }

  // datetime-local format: YYYY-MM-DDTHH:mm
  const releaseAtLocal = useMemo(() => {
    if (!form.release_at) return '';
    const d = new Date(form.release_at);
    if (isNaN(d.getTime())) return '';
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }, [form.release_at]);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
      style={{ background: 'rgba(0,0,0,0.55)' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl max-h-[88vh] overflow-y-auto rounded-xl border-2 p-6"
        style={{
          background: 'var(--color-surface-card)',
          borderColor: 'var(--color-accent-primary)',
        }}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 inline-flex items-center justify-center w-8 h-8 rounded hover:bg-[var(--color-surface-muted)]"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <X size={16} />
        </button>

        <h2 className="text-lg font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
          <Pencil size={18} /> Sửa {initial.name}
        </h2>

        <div className="space-y-3">
          <Field label="ID (không sửa được)">
            <input
              value={form.id}
              disabled
              className="w-full px-3 h-10 rounded-md outline-none border text-sm font-mono opacity-60"
              style={{
                background: 'var(--color-surface-muted)',
                borderColor: 'var(--color-border-default)',
                color: 'var(--color-text-primary)',
              }}
            />
          </Field>
          <Field label="Tên hiển thị">
            <input
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              className="w-full px-3 h-10 rounded-md outline-none border text-sm"
              style={{
                background: 'var(--color-surface-bg_elevated)',
                borderColor: 'var(--color-border-default)',
                color: 'var(--color-text-primary)',
              }}
            />
          </Field>
          <Field label="Tagline (mô tả ngắn)">
            <textarea
              value={form.tagline}
              onChange={(e) => update('tagline', e.target.value)}
              rows={2}
              className="w-full px-3 py-2 rounded-md outline-none border text-sm"
              style={{
                background: 'var(--color-surface-bg_elevated)',
                borderColor: 'var(--color-border-default)',
                color: 'var(--color-text-primary)',
              }}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Phiên bản">
              <input
                value={form.version}
                onChange={(e) => update('version', e.target.value)}
                placeholder="1.0.0"
                className="w-full px-3 h-10 rounded-md outline-none border text-sm font-mono"
                style={{
                  background: 'var(--color-surface-bg_elevated)',
                  borderColor: 'var(--color-border-default)',
                  color: 'var(--color-text-primary)',
                }}
              />
            </Field>
            <Field label="Trạng thái">
              <select
                value={form.status}
                onChange={(e) => update('status', e.target.value as Status)}
                className="w-full px-3 h-10 rounded-md outline-none border text-sm"
                style={{
                  background: 'var(--color-surface-bg_elevated)',
                  borderColor: 'var(--color-border-default)',
                  color: 'var(--color-text-primary)',
                }}
              >
                <option value="released">Đã phát hành</option>
                <option value="scheduled">Đặt lịch (countdown đến release_at)</option>
                <option value="coming_soon">Sắp ra mắt</option>
                <option value="beta">Beta</option>
                <option value="deprecated">Đã gộp / deprecated</option>
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Ngày & giờ phát hành">
              <input
                type="datetime-local"
                value={releaseAtLocal}
                onChange={(e) => {
                  if (!e.target.value) {
                    update('release_at', null);
                    return;
                  }
                  // Convert local datetime → ISO with Vietnam timezone
                  const d = new Date(e.target.value);
                  update('release_at', d.toISOString());
                }}
                className="w-full px-3 h-10 rounded-md outline-none border text-sm"
                style={{
                  background: 'var(--color-surface-bg_elevated)',
                  borderColor: 'var(--color-border-default)',
                  color: 'var(--color-text-primary)',
                }}
              />
            </Field>
            <Field label="Yêu cầu đăng nhập">
              <select
                value={form.login_required}
                onChange={(e) => update('login_required', e.target.value as LoginType)}
                className="w-full px-3 h-10 rounded-md outline-none border text-sm"
                style={{
                  background: 'var(--color-surface-bg_elevated)',
                  borderColor: 'var(--color-border-default)',
                  color: 'var(--color-text-primary)',
                }}
              >
                <option value="none">Không cần</option>
                <option value="trial">Trial</option>
                <option value="user">User (đã activate key)</option>
                <option value="admin">Admin</option>
                <option value="paid">Paid</option>
                <option value="dev">Developer</option>
              </select>
            </Field>
          </div>

          <Field label="Tính năng (mỗi dòng 1 feature)">
            <textarea
              value={form.features.join('\n')}
              onChange={(e) =>
                update(
                  'features',
                  e.target.value
                    .split('\n')
                    .map((s) => s.trim())
                    .filter(Boolean),
                )
              }
              rows={6}
              className="w-full px-3 py-2 rounded-md outline-none border text-sm"
              style={{
                background: 'var(--color-surface-bg_elevated)',
                borderColor: 'var(--color-border-default)',
                color: 'var(--color-text-primary)',
              }}
            />
          </Field>

          <Field label="URL file .exe (Windows x64)">
            <input
              value={form.download.windows_x64?.url ?? ''}
              onChange={(e) => updateDownload('url', e.target.value)}
              placeholder="https://github.com/.../App_1.0.0_x64-setup.exe"
              className="w-full px-3 h-10 rounded-md outline-none border text-sm font-mono"
              style={{
                background: 'var(--color-surface-bg_elevated)',
                borderColor: 'var(--color-border-default)',
                color: 'var(--color-text-primary)',
              }}
            />
          </Field>
          <Field label="SHA256 (tuỳ chọn — verify checksum)">
            <input
              value={form.download.windows_x64?.sha256 ?? ''}
              onChange={(e) => updateDownload('sha256', e.target.value)}
              placeholder="64 ký tự hex"
              className="w-full px-3 h-10 rounded-md outline-none border text-sm font-mono"
              style={{
                background: 'var(--color-surface-bg_elevated)',
                borderColor: 'var(--color-border-default)',
                color: 'var(--color-text-primary)',
              }}
            />
          </Field>

          <Field label="Dung lượng file (bytes)">
            <input
              type="number"
              value={form.size_bytes}
              onChange={(e) => update('size_bytes', Number(e.target.value))}
              className="w-32 px-3 h-10 rounded-md outline-none border text-sm font-mono"
              style={{
                background: 'var(--color-surface-bg_elevated)',
                borderColor: 'var(--color-border-default)',
                color: 'var(--color-text-primary)',
              }}
            />
          </Field>

          <Field label="URL Changelog">
            <input
              value={form.changelog_url}
              onChange={(e) => update('changelog_url', e.target.value)}
              placeholder="https://github.com/.../releases/tag/..."
              className="w-full px-3 h-10 rounded-md outline-none border text-sm font-mono"
              style={{
                background: 'var(--color-surface-bg_elevated)',
                borderColor: 'var(--color-border-default)',
                color: 'var(--color-text-primary)',
              }}
            />
          </Field>
        </div>

        <div className="flex justify-end gap-2 mt-5 pt-4 border-t" style={{ borderColor: 'var(--color-border-subtle)' }}>
          <button
            onClick={onClose}
            className="px-4 h-10 rounded-md text-sm font-semibold"
            style={{
              background: 'var(--color-surface-bg_elevated)',
              color: 'var(--color-text-secondary)',
              border: '1px solid var(--color-border-default)',
            }}
          >
            Huỷ
          </button>
          <button
            onClick={() => onSave(form)}
            disabled={busy}
            className="px-5 h-10 rounded-md text-sm font-bold disabled:opacity-50"
            style={{ background: 'var(--color-accent-gradient)', color: '#fff' }}
          >
            {busy ? <Loader2 size={14} className="inline animate-spin mr-1" /> : null}
            Lưu thay đổi
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label
        className="text-xs font-semibold uppercase tracking-wide mb-1.5 inline-block"
        style={{ color: 'var(--color-text-muted)' }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}
