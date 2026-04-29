/**
 * StoragePanel — Phase 19.24.4.
 *
 * Hiện Cloudinary usage:
 *   - Quota (storage / bandwidth / transformations) với progress bars
 *   - Group resources theo folder
 *   - Top 20 file lớn nhất
 *
 * Credentials nhập 1 lần, lưu localStorage (không commit code).
 */

import { useEffect, useState } from 'react';
import {
  type CloudinaryCreds,
  type CloudinaryUsage,
  type ResourceSummary,
  clearCreds,
  fetchAllResourcesSummary,
  fetchUsage,
  formatBytes,
  loadCreds,
  saveCreds,
} from '../lib/cloudinary-usage.js';

export function StoragePanel(): JSX.Element {
  const [creds, setCreds] = useState<CloudinaryCreds | null>(() => loadCreds());
  const [editingCreds, setEditingCreds] = useState(!creds);
  const [draftCreds, setDraftCreds] = useState<CloudinaryCreds>(
    creds ?? { cloudName: 'trishteam', apiKey: '', apiSecret: '' },
  );
  const [usage, setUsage] = useState<CloudinaryUsage | null>(null);
  const [summary, setSummary] = useState<ResourceSummary | null>(null);
  const [busy, setBusy] = useState<'usage' | 'scan' | null>(null);
  const [scanProgress, setScanProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  function saveDraft(): void {
    if (!draftCreds.cloudName.trim() || !draftCreds.apiKey.trim() || !draftCreds.apiSecret.trim()) {
      setError('Cần nhập đầy đủ cloud_name + api_key + api_secret.');
      return;
    }
    saveCreds(draftCreds);
    setCreds(draftCreds);
    setEditingCreds(false);
    setError(null);
  }

  function clearAll(): void {
    if (!window.confirm('Xóa credentials đã lưu?')) return;
    clearCreds();
    setCreds(null);
    setEditingCreds(true);
    setUsage(null);
    setSummary(null);
  }

  async function loadUsage(): Promise<void> {
    if (!creds) return;
    setBusy('usage');
    setError(null);
    try {
      const u = await fetchUsage(creds);
      setUsage(u);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  async function scanResources(): Promise<void> {
    if (!creds) return;
    setBusy('scan');
    setError(null);
    setScanProgress(0);
    try {
      const s = await fetchAllResourcesSummary(creds, (count) => {
        setScanProgress(count);
      });
      setSummary(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    if (creds && !usage) {
      void loadUsage();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creds]);

  return (
    <div className="panel-content">
      <header className="panel-header">
        <h1>☁ Storage / Cloudinary</h1>
        <p className="muted">
          Theo dõi quota Cloudinary (25GB free) + folder usage + top file lớn nhất.
        </p>
      </header>

      {error ? <div className="alert alert-error">{error}</div> : null}

      {/* Credentials section */}
      {editingCreds ? (
        <section className="form-section">
          <h3>🔐 Cloudinary credentials</h3>
          <p className="muted small">
            Lưu localStorage trên máy này. Không commit lên git. Lấy từ{' '}
            <a
              href="https://cloudinary.com/console"
              target="_blank"
              rel="noopener noreferrer"
            >
              Cloudinary Console
            </a>{' '}
            → Dashboard → API Environment.
          </p>
          <label>
            Cloud name:
            <input
              type="text"
              value={draftCreds.cloudName}
              onChange={(e) => setDraftCreds({ ...draftCreds, cloudName: e.target.value })}
              placeholder="trishteam"
            />
          </label>
          <label>
            API Key:
            <input
              type="text"
              value={draftCreds.apiKey}
              onChange={(e) => setDraftCreds({ ...draftCreds, apiKey: e.target.value })}
              placeholder="123456789012345"
            />
          </label>
          <label>
            API Secret:
            <input
              type="password"
              value={draftCreds.apiSecret}
              onChange={(e) => setDraftCreds({ ...draftCreds, apiSecret: e.target.value })}
              placeholder="••••••••"
            />
          </label>
          <div className="actions-row">
            <button type="button" onClick={saveDraft} className="btn btn-primary">
              💾 Lưu credentials
            </button>
            {creds ? (
              <button type="button" onClick={() => setEditingCreds(false)} className="btn btn-ghost">
                Huỷ
              </button>
            ) : null}
          </div>
        </section>
      ) : (
        <section className="form-section">
          <div className="creds-summary">
            <span>
              ✓ Đã cấu hình: <code>{creds?.cloudName}</code>
            </span>
            <button type="button" onClick={() => setEditingCreds(true)} className="btn btn-ghost btn-sm">
              ✏ Sửa
            </button>
            <button type="button" onClick={clearAll} className="btn btn-danger btn-sm">
              🗑 Xóa
            </button>
          </div>
        </section>
      )}

      {/* Usage stats */}
      {creds && !editingCreds ? (
        <>
          <section className="form-section">
            <div className="actions-row">
              <button
                type="button"
                onClick={() => void loadUsage()}
                disabled={busy !== null}
                className="btn btn-primary"
              >
                {busy === 'usage' ? '⏳ Đang tải…' : '🔄 Refresh quota'}
              </button>
              <button
                type="button"
                onClick={() => void scanResources()}
                disabled={busy !== null}
                className="btn btn-secondary"
              >
                {busy === 'scan'
                  ? `⏳ Đã scan ${scanProgress} files…`
                  : '🔍 Quét resources (top files + folders)'}
              </button>
            </div>
          </section>

          {usage ? (
            <section className="form-section">
              <h3>📊 Quota</h3>
              <p className="muted small">
                Plan: <strong>{usage.plan}</strong> · Cập nhật:{' '}
                {new Date(usage.last_updated).toLocaleString('vi-VN')}
              </p>
              <UsageBar
                label="Storage"
                used={usage.storage.usage}
                limit={usage.storage.limit}
                pct={usage.storage.used_percent}
              />
              <UsageBar
                label="Bandwidth (tháng)"
                used={usage.bandwidth.usage}
                limit={usage.bandwidth.limit}
                pct={usage.bandwidth.used_percent}
              />
              <UsageBar
                label="Transformations"
                used={usage.transformations.usage}
                limit={usage.transformations.limit}
                pct={usage.transformations.used_percent}
                isCount
              />
              <div className="muted small">
                Tổng resources: <strong>{usage.resources.toLocaleString()}</strong> ·
                Derived (transforms): <strong>{usage.derived_resources.toLocaleString()}</strong>
              </div>
            </section>
          ) : null}

          {summary ? (
            <>
              <section className="form-section">
                <h3>📁 Folders ({summary.byFolder.length})</h3>
                <p className="muted small">
                  Tổng <strong>{summary.total.toLocaleString()}</strong> files ·{' '}
                  <strong>{formatBytes(summary.totalBytes)}</strong>
                </p>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Folder</th>
                      <th>Files</th>
                      <th>Size</th>
                      <th>%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.byFolder.map((f) => (
                      <tr key={f.folder}>
                        <td>
                          <code>{f.folder}</code>
                        </td>
                        <td>{f.count.toLocaleString()}</td>
                        <td>{formatBytes(f.bytes)}</td>
                        <td>
                          {((f.bytes / summary.totalBytes) * 100).toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>

              <section className="form-section">
                <h3>🔝 Top 20 files lớn nhất</h3>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Public ID</th>
                      <th>Size</th>
                      <th>Format</th>
                      <th>Dimensions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.topFiles.map((r) => (
                      <tr key={r.public_id}>
                        <td>
                          <a
                            href={r.secure_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="path-cell"
                          >
                            {r.public_id}
                          </a>
                        </td>
                        <td>{formatBytes(r.bytes)}</td>
                        <td>{r.format}</td>
                        <td>
                          {r.width}×{r.height}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            </>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function UsageBar({
  label,
  used,
  limit,
  pct,
  isCount = false,
}: {
  label: string;
  used: number;
  limit: number;
  pct: number;
  isCount?: boolean;
}): JSX.Element {
  const tone = pct > 80 ? 'err' : pct > 60 ? 'warn' : 'ok';
  const fmt = isCount ? (n: number) => n.toLocaleString() : formatBytes;
  return (
    <div className="usage-bar-row">
      <div className="usage-bar-label">
        <strong>{label}</strong>
        <span className="muted small">
          {fmt(used)} / {fmt(limit)} ({pct.toFixed(1)}%)
        </span>
      </div>
      <div className="progress-bar">
        <div
          className={`progress-fill progress-${tone}`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
    </div>
  );
}
