/**
 * Phase 17.3 — TrishSearch SettingsModal.
 *
 * Theme + font size + update check + about. Có nút Lưu (apply qua Save).
 */

import { useEffect, useState } from 'react';
import {
  type AppSettings,
  type Theme,
  FONT_SIZE_MIN,
  FONT_SIZE_MAX,
  applySettings,
  saveSettings,
} from './settings.js';
import {
  checkForUpdate,
  getOcrStatus,
  setOcrSettings,
  type UpdateInfo,
  type OcrStatus,
} from './tauri-bridge.js';
import { openUrl } from '@tauri-apps/plugin-opener';

interface Props {
  settings: AppSettings;
  appVersion: string;
  onSettingsChange: (s: AppSettings) => void;
  onClose: () => void;
}

export function SettingsModal({
  settings,
  appVersion,
  onSettingsChange,
  onClose,
}: Props): JSX.Element {
  const [draft, setDraft] = useState<AppSettings>(settings);
  const [savedFlash, setSavedFlash] = useState(false);
  const [checking, setChecking] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [updateMsg, setUpdateMsg] = useState<string | null>(null);

  // OCR state
  const [ocr, setOcr] = useState<OcrStatus | null>(null);
  const [ocrLanguages, setOcrLanguages] = useState('vie+eng');
  const [ocrSaving, setOcrSaving] = useState(false);
  const [ocrFlash, setOcrFlash] = useState<string | null>(null);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  // Load OCR status mỗi lần mở Settings
  useEffect(() => {
    void getOcrStatus().then((s) => {
      setOcr(s);
      setOcrLanguages(s.languages || 'vie+eng');
    });
  }, []);

  async function handleSaveOcr(enabled: boolean): Promise<void> {
    setOcrSaving(true);
    try {
      await setOcrSettings(enabled, ocrLanguages);
      const fresh = await getOcrStatus();
      setOcr(fresh);
      setOcrFlash(
        enabled
          ? '✓ Đã bật OCR. Reindex location để OCR PDF scan + ảnh.'
          : '✓ Đã tắt OCR.',
      );
      setTimeout(() => setOcrFlash(null), 2500);
    } catch (err) {
      setOcrFlash(`⚠ Lỗi: ${err instanceof Error ? err.message : err}`);
    } finally {
      setOcrSaving(false);
    }
  }

  async function handleSaveLanguages(): Promise<void> {
    if (!ocr) return;
    await handleSaveOcr(ocr.enabled);
  }

  const dirty = draft.theme !== settings.theme || draft.fontSize !== settings.fontSize;

  function patch<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function handleSave(): void {
    saveSettings(draft);
    applySettings(draft);
    onSettingsChange(draft);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
  }

  function handleReset(): void {
    setDraft(settings);
  }

  async function handleClose(): Promise<void> {
    if (dirty) {
      const ok = window.confirm('Cài đặt đã thay đổi nhưng chưa lưu.\n\nĐóng và bỏ thay đổi?');
      if (!ok) return;
    }
    onClose();
  }

  async function handleCheckUpdate(): Promise<void> {
    if (checking) return;
    setChecking(true);
    setUpdateMsg(null);
    try {
      const info = await checkForUpdate(appVersion);
      setUpdateInfo(info);
      if (info.hasUpdate) {
        setUpdateMsg(`✓ Có bản mới: ${info.latest} (đang dùng ${info.current})`);
      } else {
        setUpdateMsg(`✓ Đang dùng bản mới nhất (${info.current})`);
      }
    } catch (err) {
      setUpdateMsg(`⚠ Lỗi: ${err instanceof Error ? err.message : err}`);
    } finally {
      setChecking(false);
    }
  }

  async function handleDownload(): Promise<void> {
    if (!updateInfo?.downloadUrl) return;
    try {
      await openUrl(updateInfo.downloadUrl);
    } catch (err) {
      console.warn('[trishsearch] open download fail:', err);
    }
  }

  return (
    <div className="modal-backdrop" onClick={() => void handleClose()}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 540 }}>
        <header className="modal-head">
          <h2>⚙ Cài đặt {dirty && <span className="muted small">· chưa lưu</span>}</h2>
          <button className="mini" onClick={() => void handleClose()}>
            ×
          </button>
        </header>

        <div className="modal-body">
          {/* Giao diện */}
          <section className="settings-section">
            <h3>Giao diện</h3>
            <div className="settings-row">
              <div className="settings-label">
                <strong>Theme</strong>
                <p className="muted small">Sáng / tối / tự động theo OS</p>
              </div>
              <div className="settings-control">
                {(['auto', 'light', 'dark'] as Theme[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`pill-btn ${draft.theme === t ? 'active' : ''}`}
                    onClick={() => patch('theme', t)}
                  >
                    {t === 'auto' ? '🌓 Auto' : t === 'light' ? '☀ Sáng' : '🌙 Tối'}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Cỡ chữ */}
          <section className="settings-section">
            <h3>Chữ viết</h3>
            <div className="settings-row">
              <div className="settings-label">
                <strong>Cỡ chữ giao diện</strong>
                <p className="muted small">{FONT_SIZE_MIN}-{FONT_SIZE_MAX} px</p>
              </div>
              <div className="settings-control">
                <input
                  type="range"
                  min={FONT_SIZE_MIN}
                  max={FONT_SIZE_MAX}
                  step={1}
                  value={draft.fontSize}
                  onChange={(e) => patch('fontSize', Number(e.target.value))}
                />
                <span className="size-display">{draft.fontSize}px</span>
              </div>
            </div>
          </section>

          {/* OCR */}
          <section className="settings-section">
            <h3>🔍 OCR — PDF scan + ảnh</h3>
            {ocr === null ? (
              <p className="muted small">Đang tải trạng thái OCR…</p>
            ) : (
              <>
                <div className="settings-row">
                  <div className="settings-label">
                    <strong>Ngôn ngữ OCR</strong>
                    <p className="muted small">
                      Tesseract.js + PDF.js (offline, chạy trong app).
                      <br />
                      Mã: <code>vie</code> / <code>eng</code> / <code>vie+eng</code>
                    </p>
                  </div>
                  <div className="settings-control">
                    <input
                      type="text"
                      value={ocrLanguages}
                      onChange={(e) => setOcrLanguages(e.target.value)}
                      placeholder="vie+eng"
                      style={{ width: 110 }}
                    />
                    <button
                      className="btn btn-ghost"
                      onClick={() => void handleSaveLanguages()}
                      disabled={ocrSaving}
                    >
                      Lưu ngôn ngữ
                    </button>
                  </div>
                </div>

                <div
                  className="muted small"
                  style={{
                    marginTop: 8,
                    padding: 10,
                    background: 'var(--panel-alt)',
                    borderRadius: 6,
                  }}
                >
                  <p style={{ margin: 0 }}>
                    💡 OCR chạy theo nhu cầu: chọn 1 file PDF/ảnh chưa có content
                    trong kết quả search → bấm nút <strong>🔍 OCR file này</strong>{' '}
                    trong panel chi tiết.
                  </p>
                  <p style={{ margin: '6px 0 0 0' }}>
                    Lần đầu OCR sẽ tải model Tesseract Vietnamese (~30MB) — đã
                    bundle sẵn trong installer, không cần internet.
                  </p>
                  <p style={{ margin: '6px 0 0 0' }}>
                    Tốc độ: PDF 10 trang ~1-2 phút. Ảnh đơn ~5-15s.
                  </p>
                </div>

                {ocrFlash && (
                  <p
                    className="small"
                    style={{ marginTop: 8, color: 'var(--accent)' }}
                  >
                    {ocrFlash}
                  </p>
                )}
              </>
            )}
          </section>

          {/* Update check */}
          <section className="settings-section">
            <h3>Cập nhật</h3>
            <p className="muted small" style={{ marginBottom: 8 }}>
              Phiên bản hiện tại: <code>{appVersion}</code>
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-ghost"
                onClick={() => void handleCheckUpdate()}
                disabled={checking}
              >
                {checking ? '⏳ Đang kiểm tra…' : '🔄 Kiểm tra bản mới'}
              </button>
              {updateInfo?.hasUpdate && updateInfo.downloadUrl && (
                <button className="btn btn-primary" onClick={() => void handleDownload()}>
                  ⬇ Tải bản {updateInfo.latest}
                </button>
              )}
            </div>
            {updateMsg && (
              <p className="muted small" style={{ marginTop: 6 }}>
                {updateMsg}
              </p>
            )}
          </section>

          {/* About */}
          <section className="settings-section">
            <h3>Thông tin</h3>
            <p className="muted small">
              TrishSearch v{appVersion} — Full-text search BM25 offline. Index in-memory cho ghi
              chú TrishNote, thư viện TrishLibrary, file text rời. 100% local.
            </p>
            <p className="muted small" style={{ marginTop: 8 }}>
              <strong>Phím tắt:</strong> Ctrl+K focus search · Esc clear query
            </p>
          </section>
        </div>

        <footer className="modal-foot">
          <span className="muted small">
            {savedFlash ? '✓ Đã lưu' : dirty ? '● Có thay đổi chưa lưu' : '— không có thay đổi —'}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            {dirty && (
              <button className="btn btn-ghost" onClick={handleReset}>
                ↺ Khôi phục
              </button>
            )}
            <button className="btn btn-ghost" onClick={() => void handleClose()}>
              Đóng
            </button>
            <button className="btn btn-primary" onClick={handleSave} disabled={!dirty}>
              ✓ Lưu cài đặt
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
