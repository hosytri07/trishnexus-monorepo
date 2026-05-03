/**
 * TrishDesign — Cài đặt (Phase 28.5 + 28.8).
 *
 * - Theme: Auto / Sáng / Tối — connect với theme.ts manager
 * - Cỡ chữ: Nhỏ / Vừa / Lớn — apply trực tiếp
 * - Sidebar mặc định: Mở / Thu gọn — persist localStorage
 * - Đường dẫn lưu trữ + tích hợp phần mềm
 * - 🔐 API keys (admin only) — local override + show Cloud sync status
 *   (sync chính set ở TrishAdmin → 🔐 API Keys, Phase 28.8)
 */

import { useState, useEffect } from 'react';
import { useAuth } from '@trishteam/auth/react';
import {
  type ThemeMode,
  type FontSize,
  getStoredTheme,
  getStoredFontSize,
  setTheme,
  setFontSize,
} from '../../lib/theme.js';
import { readSyncMeta } from '../../lib/use-api-keys-sync.js';
import { resolveTenantId, getActiveTenantId } from '@trishteam/admin-keys';

const COLLAPSE_KEY = 'trishdesign.sidebar_collapsed';
const ACAD_VERSION_KEY = 'trishdesign:acadVersion';
const OFFICE_VERSION_KEY = 'trishdesign:officeVersion';
const LANG_KEY = 'trishdesign:lang';
const CLAUDE_KEY_LS = 'trishdesign:claude-api-key';
const GROQ_KEY_LS = 'trishdesign:groq-api-key';
const GEMINI_KEY_LS = 'trishdesign:gemini-api-key';

function readLs(key: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  try { return window.localStorage.getItem(key) ?? fallback; }
  catch { return fallback; }
}
function writeLs(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(key, value); }
  catch { /* ignore */ }
}

export function SettingsPanel(): JSX.Element {
  const { role, profile } = useAuth();
  const isAdmin = role === 'admin';

  const [theme, setThemeState] = useState<ThemeMode>(() => getStoredTheme());
  const [fontSize, setFontSizeState] = useState<FontSize>(() => getStoredFontSize());
  const [lang, setLang] = useState<string>(() => readLs(LANG_KEY, 'vi'));
  const [sidebarDefault, setSidebarDefault] = useState<string>(
    () => readLs(COLLAPSE_KEY, '0') === '1' ? 'collapsed' : 'expanded',
  );
  const [acadVersion, setAcadVersion] = useState<string>(() => readLs(ACAD_VERSION_KEY, 'AutoCAD 2024'));
  const [officeVersion, setOfficeVersion] = useState<string>(() => readLs(OFFICE_VERSION_KEY, 'Office 365'));
  const [savedFlash, setSavedFlash] = useState<string | null>(null);
  // Phase 28.7e + 28.9 — API keys (admin only) local override
  const [claudeKey, setClaudeKey] = useState<string>(() => readLs(CLAUDE_KEY_LS, ''));
  const [groqKey, setGroqKey] = useState<string>(() => readLs(GROQ_KEY_LS, ''));
  const [geminiKey, setGeminiKey] = useState<string>(() => readLs(GEMINI_KEY_LS, ''));
  const [showClaudeKey, setShowClaudeKey] = useState(false);
  const [showGroqKey, setShowGroqKey] = useState(false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showPaidKeys, setShowPaidKeys] = useState(false);
  // Phase 28.8 — Cloud sync status
  const [syncMeta, setSyncMeta] = useState(() => readSyncMeta());
  const profileTenant = resolveTenantId(profile);
  const activeTenant = getActiveTenantId();

  function flash(msg: string): void {
    setSavedFlash(msg);
    setTimeout(() => setSavedFlash(null), 1500);
  }

  function handleThemeChange(v: ThemeMode): void {
    setThemeState(v);
    setTheme(v);
    flash('✓ Đã đổi theme');
  }

  function handleFontSizeChange(v: FontSize): void {
    setFontSizeState(v);
    setFontSize(v);
    flash('✓ Đã đổi cỡ chữ');
  }

  function handleSidebarDefault(v: string): void {
    setSidebarDefault(v);
    writeLs(COLLAPSE_KEY, v === 'collapsed' ? '1' : '0');
    flash('✓ Đã lưu (cần restart app để áp dụng)');
  }

  function handleLangChange(v: string): void {
    setLang(v);
    writeLs(LANG_KEY, v);
    flash('✓ Đã đổi ngôn ngữ');
  }

  function handleAcadChange(v: string): void {
    setAcadVersion(v);
    writeLs(ACAD_VERSION_KEY, v);
    flash('✓ Đã lưu');
  }

  function handleOfficeChange(v: string): void {
    setOfficeVersion(v);
    writeLs(OFFICE_VERSION_KEY, v);
    flash('✓ Đã lưu');
  }

  function handleResetDefaults(): void {
    if (!window.confirm('Reset tất cả cài đặt giao diện về mặc định?')) return;
    handleThemeChange('auto');
    handleFontSizeChange('medium');
    handleSidebarDefault('expanded');
    handleLangChange('vi');
    flash('✓ Đã reset về mặc định');
  }

  function handleSaveClaudeKey(): void {
    writeLs(CLAUDE_KEY_LS, claudeKey);
    flash(claudeKey ? '✓ Đã lưu Claude API key' : '✓ Đã xoá Claude API key');
  }
  function handleSaveGroqKey(): void {
    writeLs(GROQ_KEY_LS, groqKey);
    flash(groqKey ? '✓ Đã lưu Groq API key' : '✓ Đã xoá Groq API key');
  }
  function handleSaveGeminiKey(): void {
    writeLs(GEMINI_KEY_LS, geminiKey);
    flash(geminiKey ? '✓ Đã lưu Gemini API key' : '✓ Đã xoá Gemini API key');
  }

  useEffect(() => {
    /* no-op */
  }, [theme]);

  // Phase 28.8 — Listen sync event từ useApiKeysSync hook
  useEffect(() => {
    function onSync(): void {
      setSyncMeta(readSyncMeta());
      setGroqKey(readLs(GROQ_KEY_LS, ''));
      setGeminiKey(readLs(GEMINI_KEY_LS, ''));
      setClaudeKey(readLs(CLAUDE_KEY_LS, ''));
    }
    window.addEventListener('trishdesign:apikey-synced', onSync);
    return () => window.removeEventListener('trishdesign:apikey-synced', onSync);
  }, []);

  function fmtSyncTime(ms: number): string {
    if (!ms) return '—';
    const diff = Date.now() - ms;
    if (diff < 60_000) return `${Math.floor(diff / 1000)}s trước`;
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} phút trước`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} giờ trước`;
    return new Date(ms).toLocaleString('vi-VN');
  }

  return (
    <div className="td-panel">
      <header className="td-panel-head">
        <h1>⚙ Cài đặt</h1>
        <p className="td-lead">Tùy chỉnh giao diện, ngôn ngữ, đường dẫn lưu trữ + tích hợp với phần mềm ngoài.</p>
        {savedFlash && <span className="td-saved-flash">{savedFlash}</span>}
      </header>

      <section className="td-section">
        <h2 className="td-section-title">Giao diện</h2>
        <div className="td-section-body">
          <div className="td-form-row">
            <label className="td-field">
              <span className="td-field-label">Theme</span>
              <select
                className="td-select"
                value={theme}
                onChange={(e) => handleThemeChange(e.target.value as ThemeMode)}
              >
                <option value="auto">🖥 Tự động (theo hệ thống)</option>
                <option value="light">☀ Sáng</option>
                <option value="dark">🌙 Tối</option>
              </select>
            </label>
            <label className="td-field">
              <span className="td-field-label">Ngôn ngữ</span>
              <select className="td-select" value={lang} onChange={(e) => handleLangChange(e.target.value)}>
                <option value="vi">🇻🇳 Tiếng Việt</option>
                <option value="en">🇺🇸 English</option>
              </select>
            </label>
            <label className="td-field">
              <span className="td-field-label">Cỡ chữ</span>
              <select
                className="td-select"
                value={fontSize}
                onChange={(e) => handleFontSizeChange(e.target.value as FontSize)}
              >
                <option value="small">Nhỏ (12px)</option>
                <option value="medium">Vừa (13px) — mặc định</option>
                <option value="large">Lớn (15px)</option>
              </select>
            </label>
            <label className="td-field">
              <span className="td-field-label">Sidebar mặc định</span>
              <select
                className="td-select"
                value={sidebarDefault}
                onChange={(e) => handleSidebarDefault(e.target.value)}
              >
                <option value="expanded">Mở</option>
                <option value="collapsed">Thu gọn</option>
              </select>
            </label>
          </div>
        </div>
      </section>

      <section className="td-section">
        <h2 className="td-section-title">Đường dẫn lưu trữ</h2>
        <div className="td-section-body">
          <div className="td-form-row">
            <label className="td-field">
              <span className="td-field-label">Thư mục dự án mặc định</span>
              <input type="text" className="td-input" placeholder="C:\Users\...\TrishDesign\Projects" />
            </label>
            <label className="td-field">
              <span className="td-field-label">Thư mục template</span>
              <input type="text" className="td-input" placeholder="..." />
            </label>
            <label className="td-field">
              <span className="td-field-label">Thư mục LSP</span>
              <input type="text" className="td-input" placeholder="%appdata%\Autodesk..." />
            </label>
          </div>
          <div className="td-action-row" style={{ marginTop: 12 }}>
            <button type="button" className="btn btn-ghost">📂 Mở thư mục data</button>
            <button type="button" className="btn btn-ghost" onClick={handleResetDefaults}>🔄 Reset về mặc định</button>
          </div>
        </div>
      </section>

      {isAdmin && (
        <section className="td-section">
          <h2 className="td-section-title">
            🔐 API Keys — AI integration{' '}
            <span className="muted small" style={{ fontWeight: 400, fontSize: 11 }}>
              (chỉ Admin thấy section này)
            </span>
          </h2>
          <div className="td-section-body">
            <div
              style={{
                marginBottom: 12,
                padding: '10px 14px',
                background: 'var(--color-accent-soft)',
                borderRadius: 8,
                color: 'var(--color-accent-primary)',
                fontSize: 12,
              }}
            >
              ☁ <strong>Cloud sync:</strong>{' '}
              {syncMeta ? (
                <>
                  Đã sync từ tenant <code>{syncMeta.tenant}</code>{' '}
                  {fmtSyncTime(syncMeta.lastSyncAt)}
                  {syncMeta.fromFirestore.groq ? ' · ⚡ Groq' : ''}
                  {syncMeta.fromFirestore.gemini ? ' · ✨ Gemini' : ''}
                  {syncMeta.fromFirestore.claude ? ' · 🔑 Claude' : ''}
                </>
              ) : (
                <>
                  Chưa nhận key từ Firestore (active tenant: <code>{activeTenant}</code>, profile: <code>{profileTenant}</code>).
                </>
              )}
            </div>
            <p className="muted small" style={{ marginBottom: 12 }}>
              💡 Khuyến nghị: dùng <strong>TrishAdmin → 🔐 API Keys</strong> để encrypt + sync xuống tất cả máy + audit log.
              Phần dưới chỉ override local cho máy này.
            </p>
            <div className="td-form-row">
              <label className="td-field">
                <span className="td-field-label">
                  ⚡ Groq API Key{' '}
                  <span style={{ fontSize: 10, padding: '1px 6px', background: '#10b981', color: 'white', borderRadius: 4, marginLeft: 4 }}>FREE</span>
                  <span className="muted" style={{ marginLeft: 6, fontWeight: 400 }}>— Llama 3.3 70B + Vision 90B</span>
                </span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    type={showGroqKey ? 'text' : 'password'}
                    className="td-input"
                    placeholder="gsk_xxx..."
                    value={groqKey}
                    onChange={(e) => setGroqKey(e.target.value)}
                  />
                  <button type="button" className="btn btn-ghost" onClick={() => setShowGroqKey((v) => !v)}>
                    {showGroqKey ? '🙈' : '👁'}
                  </button>
                  <button type="button" className="btn btn-primary" onClick={handleSaveGroqKey}>💾</button>
                </div>
                <span className="muted small" style={{ fontSize: 10.5 }}>
                  Đăng ký free tại console.groq.com · {groqKey ? `✓ ${groqKey.length} ký tự đã lưu` : '⚠ Chưa có key'}
                </span>
              </label>
              <label className="td-field">
                <span className="td-field-label">
                  ✨ Gemini API Key{' '}
                  <span style={{ fontSize: 10, padding: '1px 6px', background: '#10b981', color: 'white', borderRadius: 4, marginLeft: 4 }}>FREE</span>
                  <span className="muted" style={{ marginLeft: 6, fontWeight: 400 }}>— Gemini 2.0 Flash + Vision</span>
                </span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    type={showGeminiKey ? 'text' : 'password'}
                    className="td-input"
                    placeholder="AIza..."
                    value={geminiKey}
                    onChange={(e) => setGeminiKey(e.target.value)}
                  />
                  <button type="button" className="btn btn-ghost" onClick={() => setShowGeminiKey((v) => !v)}>
                    {showGeminiKey ? '🙈' : '👁'}
                  </button>
                  <button type="button" className="btn btn-primary" onClick={handleSaveGeminiKey}>💾</button>
                </div>
                <span className="muted small" style={{ fontSize: 10.5 }}>
                  Đăng ký free tại aistudio.google.com (login Google, không cần thẻ) · {geminiKey ? `✓ ${geminiKey.length} ký tự đã lưu` : '⚠ Chưa có key'}
                </span>
              </label>
              <label style={{ fontSize: 11, display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer', marginTop: 4 }}>
                <input type="checkbox" checked={showPaidKeys} onChange={(e) => setShowPaidKeys(e.target.checked)} />
                <span className="muted">Hiện thêm AI paid (Claude — yêu cầu thẻ visa)</span>
              </label>
              {showPaidKeys && (
                <label className="td-field">
                  <span className="td-field-label">🔑 Claude API Key (Anthropic — paid, $5 trial credit)</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      type={showClaudeKey ? 'text' : 'password'}
                      className="td-input"
                      placeholder="sk-ant-xxx..."
                      value={claudeKey}
                      onChange={(e) => setClaudeKey(e.target.value)}
                    />
                    <button type="button" className="btn btn-ghost" onClick={() => setShowClaudeKey((v) => !v)}>
                      {showClaudeKey ? '🙈' : '👁'}
                    </button>
                    <button type="button" className="btn btn-primary" onClick={handleSaveClaudeKey}>💾</button>
                  </div>
                  <span className="muted small" style={{ fontSize: 10.5 }}>
                    Đăng ký tại console.anthropic.com · {claudeKey ? `✓ ${claudeKey.length} ký tự đã lưu` : '⚠ Chưa có key'}
                  </span>
                </label>
              )}
            </div>
            <p className="muted small" style={{ marginTop: 14, padding: '10px 14px', background: 'var(--color-surface-soft, #f5f5f5)', borderRadius: 8 }}>
              💡 Sau khi lưu, AI sẽ hoạt động trong: 🤖 Chatbot AutoCAD và 🔍 Khảo sát OCR.
            </p>
          </div>
        </section>
      )}

      <section className="td-section">
        <h2 className="td-section-title">Tích hợp phần mềm</h2>
        <div className="td-section-body">
          <div className="td-form-row">
            <label className="td-field">
              <span className="td-field-label">Phiên bản AutoCAD</span>
              <select className="td-select" value={acadVersion} onChange={(e) => handleAcadChange(e.target.value)}>
                <option>AutoCAD 2025</option>
                <option>AutoCAD 2024</option>
                <option>AutoCAD 2023</option>
                <option>AutoCAD 2022</option>
                <option>AutoCAD LT</option>
                <option>BricsCAD</option>
                <option>ZWCAD</option>
              </select>
            </label>
            <label className="td-field">
              <span className="td-field-label">Microsoft Office</span>
              <select className="td-select" value={officeVersion} onChange={(e) => handleOfficeChange(e.target.value)}>
                <option>Office 365</option>
                <option>Office 2021</option>
                <option>Office 2019</option>
                <option>WPS / LibreOffice</option>
              </select>
            </label>
          </div>
        </div>
      </section>

      <section className="td-section">
        <h2 className="td-section-title">Về ứng dụng</h2>
        <div className="td-section-body">
          <p className="muted small">
            <strong>TrishDesign</strong> v2.1.0 — Bộ công cụ Khảo sát &amp; Thiết kế.<br />
            © 2026 TrishTEAM · <a href="https://trishteam.io.vn" target="_blank" rel="noreferrer">trishteam.io.vn</a>
          </p>
        </div>
      </section>
    </div>
  );
}
