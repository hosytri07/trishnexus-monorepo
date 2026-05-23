/**
 * LockedPanel — Phase 28.12.
 *
 * Banner "Chức năng đang phát triển" + form góp ý có đính kèm file → gửi
 * Telegram bot (cấu hình ở TrishAdmin → 🔐 API Keys → 📨 Telegram Bot).
 *
 * Use:
 *   {role !== 'admin' ? <LockedPanel feature="Danh mục hồ sơ" icon="📂" /> : <DocumentsPanel />}
 */

import { useState, useRef } from 'react';
import { useAuth } from '@trishteam/auth/react';
import { invoke } from '@tauri-apps/api/core';

const TG_BOT_LS = 'trishdesign:tg-feedback-bot-token';
const TG_CHAT_LS = 'trishdesign:tg-feedback-chat-id';

interface Props {
  feature: string;     // Tên tính năng đang khoá
  icon?: string;       // Icon emoji
  description?: string; // Mô tả thêm tuỳ chọn
}

export function LockedPanel({ feature, icon = '🔒', description }: Props): JSX.Element {
  const { firebaseUser, profile } = useAuth();
  const [message, setMessage] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [sentOk, setSentOk] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function handlePickFiles(): void {
    fileRef.current?.click();
  }
  function handleFilesChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const list = e.target.files;
    if (!list) return;
    const arr = Array.from(list);
    // Max 20MB tổng
    const totalSize = arr.reduce((s, f) => s + f.size, 0);
    if (totalSize > 20 * 1024 * 1024) {
      setErrMsg(`File quá lớn (${(totalSize / 1024 / 1024).toFixed(1)}MB > 20MB). Bỏ bớt file.`);
      return;
    }
    setFiles((prev) => [...prev, ...arr]);
    setErrMsg(null);
  }
  function handleRemoveFile(idx: number): void {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSend(): Promise<void> {
    if (!message.trim() && files.length === 0) {
      setErrMsg('Nhập nội dung hoặc đính kèm file trước khi gửi.');
      return;
    }
    const botToken = (typeof window !== 'undefined' ? localStorage.getItem(TG_BOT_LS) ?? '' : '').trim();
    const chatId = (typeof window !== 'undefined' ? localStorage.getItem(TG_CHAT_LS) ?? '' : '').trim();
    if (!botToken || !chatId) {
      setErrMsg('Chưa cấu hình Telegram bot. Liên hệ admin (TrishAdmin → 🔐 API Keys → 📨 Telegram Bot).');
      return;
    }

    setSending(true);
    setErrMsg(null);
    try {
      const userInfo = `<b>👤 Từ user:</b> ${profile?.display_name ?? firebaseUser?.email ?? 'Anonymous'}\n<b>📧 Email:</b> ${firebaseUser?.email ?? '—'}\n<b>🔧 Tính năng:</b> ${feature}\n<b>🕒 Lúc:</b> ${new Date().toLocaleString('vi-VN')}`;
      const fullMsg = `📝 <b>Góp ý từ TrishDesign</b>\n\n${userInfo}\n\n<b>Nội dung:</b>\n${escapeHtml(message.trim() || '(không có nội dung text)')}`;

      // 1. Send text message
      await invoke('tg_send_message', {
        req: { botToken, chatId, text: fullMsg },
      });

      // 2. Send each file as document
      for (const file of files) {
        const arrayBuf = await file.arrayBuffer();
        const bytes = Array.from(new Uint8Array(arrayBuf));
        await invoke('tg_send_document', {
          req: {
            botToken,
            chatId,
            caption: `📎 ${file.name} (${(file.size / 1024).toFixed(1)} KB) — góp ý ${feature}`,
            filename: file.name,
            fileData: bytes,
          },
        });
      }

      setSentOk(true);
      setMessage('');
      setFiles([]);
      setTimeout(() => setSentOk(false), 5000);
    } catch (e) {
      setErrMsg(`Lỗi gửi: ${String(e).slice(0, 200)}`);
    } finally {
      setSending(false);
    }
  }

  function escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  return (
    <div className="td-panel">
      <div
        style={{
          padding: 32,
          background: 'var(--color-surface, #1a1a1a)',
          border: '2px dashed var(--color-accent-primary, #10b981)',
          borderRadius: 12,
          textAlign: 'center',
          marginBottom: 16,
        }}
      >
        <div style={{ fontSize: 56, marginBottom: 8 }}>{icon}</div>
        <h1 style={{ margin: '0 0 8px', fontSize: 22 }}>{feature}</h1>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--color-fg-muted, #888)' }}>
          🚧 <strong>Chức năng đang được phát triển.</strong>
        </p>
        {description && (
          <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--color-fg-muted, #888)' }}>
            {description}
          </p>
        )}
        <p style={{ margin: '12px 0 0', fontSize: 13 }}>
          Nếu có vấn đề / góp ý, vui lòng đính kèm file dưới đây để gửi admin.
        </p>
      </div>

      <section
        style={{
          padding: 16,
          background: 'var(--color-surface, #1a1a1a)',
          border: '1px solid var(--color-border-soft, #2a2a2a)',
          borderRadius: 8,
        }}
      >
        <h2 style={{ fontSize: 14, fontWeight: 600, marginTop: 0, marginBottom: 10 }}>📨 Góp ý → Admin TrishTEAM</h2>

        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Nội dung góp ý</label>
        <textarea
          className="td-input"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={`Mô tả vấn đề bạn gặp với "${feature}", hoặc gợi ý cải thiện...`}
          style={{ width: '100%', minHeight: 120, fontFamily: 'inherit', fontSize: 13, padding: 10, marginBottom: 12 }}
        />

        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
          Đính kèm file (tối đa 20MB tổng — ảnh, Excel, Word, PDF...)
        </label>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
          <button type="button" className="btn btn-ghost" onClick={handlePickFiles}>📎 Chọn file</button>
          <input ref={fileRef} type="file" multiple onChange={handleFilesChange} hidden />
          <span className="muted small">{files.length} file đã chọn</span>
        </div>
        {files.length > 0 && (
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 12px', fontSize: 12 }}>
            {files.map((f, i) => (
              <li key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px', background: 'var(--color-surface-soft, #252525)', borderRadius: 4, marginBottom: 4 }}>
                <span>📄 {f.name} ({(f.size / 1024).toFixed(1)} KB)</span>
                <button type="button" className="atgt-del-btn" onClick={() => handleRemoveFile(i)}>🗑</button>
              </li>
            ))}
          </ul>
        )}

        {errMsg && (
          <div style={{ padding: 10, background: 'var(--color-danger-soft, #fee)', color: 'var(--color-danger, #c00)', borderRadius: 6, marginBottom: 8, fontSize: 12 }}>
            ❌ {errMsg}
          </div>
        )}
        {sentOk && (
          <div style={{ padding: 10, background: 'var(--color-accent-soft, #d1fae5)', color: 'var(--color-accent-primary, #059669)', borderRadius: 6, marginBottom: 8, fontSize: 12 }}>
            ✓ Đã gửi góp ý cho admin. Cảm ơn Trí!
          </div>
        )}

        <button
          type="button"
          className="btn btn-primary"
          onClick={() => void handleSend()}
          disabled={sending || (!message.trim() && files.length === 0)}
          style={{ width: '100%' }}
        >
          {sending ? '⏳ Đang gửi...' : '📤 Gửi góp ý đến admin'}
        </button>
      </section>
    </div>
  );
}
