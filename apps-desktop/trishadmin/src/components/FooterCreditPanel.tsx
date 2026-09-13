/**
 * FooterCreditPanel — sửa dòng credit chạy ở footer của tất cả app.
 *
 * Ghi vào Firestore `app_config/footer_credit` = { text, speedSec, enabled }.
 * Mọi app (TrishWork/Utilities/Finance) đọc realtime qua AppFooterCredit →
 * sửa ở đây là cập nhật ngay, không cần build lại.
 */

import { useEffect, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getFirebaseDb } from '@trishteam/auth';
import { useAuth } from '@trishteam/auth/react';
import { writeAudit } from '../lib/firestore-admin.js';

const DEFAULT_TEXT =
  '© 2026 TrishTEAM — Phát triển bởi Trí — Góp ý tại website hoặc liên hệ trishteam.official@gmail.com — Phần mềm không có mục đích thương mại, nên vui lòng không đem ra mua bán, mọi sự ủng hộ xin gửi vào các quỹ từ thiện của Chính phủ. Xin cảm ơn!';

export function FooterCreditPanel(): JSX.Element {
  const { firebaseUser } = useAuth();
  const [text, setText] = useState('');
  const [speedSec, setSpeedSec] = useState(45);
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const snap = await getDoc(doc(getFirebaseDb(), 'app_config', 'footer_credit'));
        if (snap.exists()) {
          const d = snap.data() as { text?: string; speedSec?: number; enabled?: boolean };
          setText(d.text ?? DEFAULT_TEXT);
          setSpeedSec(d.speedSec ?? 45);
          setEnabled(d.enabled !== false);
        } else {
          setText(DEFAULT_TEXT);
        }
      } catch (e) {
        setMsg(`✗ Lỗi tải: ${String(e)}`);
        setText(DEFAULT_TEXT);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleSave(): Promise<void> {
    try {
      const db = getFirebaseDb();
      await setDoc(
        doc(db, 'app_config', 'footer_credit'),
        { text: text.trim(), speedSec, enabled, updated_at: Date.now() },
        { merge: true },
      );
      await writeAudit({
        action: 'app_config.footer_credit.update',
        actor_uid: firebaseUser?.uid ?? '',
        actor_email: firebaseUser?.email ?? undefined,
        target_type: 'app_config',
        target_id: 'footer_credit',
        target_label: 'Footer credit',
        details: { speedSec, enabled, len: text.trim().length },
      });
      setMsg('✓ Đã lưu — các app sẽ cập nhật ngay.');
      setTimeout(() => setMsg(null), 3000);
    } catch (e) {
      setMsg(`✗ Lỗi lưu: ${String(e)}`);
    }
  }

  if (loading) return <div style={{ padding: 24 }}>Đang tải…</div>;

  return (
    <div style={{ padding: 24, maxWidth: 760 }}>
      <h1 style={{ marginBottom: 4 }}>📢 Footer credit</h1>
      <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginTop: 0 }}>
        Dòng chữ chạy ở đáy mọi app (TrishWork · Utilities · Finance). Sửa ở đây áp dụng ngay cho tất cả.
      </p>

      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginTop: 16 }}>Nội dung</label>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        style={{ width: '100%', marginTop: 6, padding: 10, fontSize: 13, lineHeight: 1.5 }}
      />

      <div style={{ display: 'flex', gap: 24, marginTop: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ fontSize: 13 }}>
          Tốc độ 1 vòng (giây):{' '}
          <input
            type="number"
            min={10}
            max={120}
            value={speedSec}
            onChange={(e) => setSpeedSec(Number(e.target.value) || 45)}
            style={{ width: 70, padding: 6 }}
          />
          <span style={{ color: 'var(--color-text-muted)', marginLeft: 6 }}>(lớn hơn = chậm hơn)</span>
        </label>
        <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Hiển thị footer
        </label>
      </div>

      <div style={{ marginTop: 18, display: 'flex', gap: 10, alignItems: 'center' }}>
        <button type="button" className="btn btn-primary" onClick={() => void handleSave()}>💾 Lưu</button>
        <button type="button" className="btn btn-ghost" onClick={() => setText(DEFAULT_TEXT)}>↺ Khôi phục mặc định</button>
        {msg && <span style={{ fontSize: 13 }}>{msg}</span>}
      </div>

      {/* Preview */}
      <div style={{ marginTop: 24 }}>
        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 6 }}>Xem trước:</div>
        <div style={{ border: '1px solid var(--color-border-subtle, #333)', borderRadius: 6, overflow: 'hidden', height: 28, display: 'flex', alignItems: 'center', padding: '0 12px', fontSize: 12.5, color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
          {enabled ? (text || DEFAULT_TEXT) : '(footer đang tắt)'}
        </div>
      </div>
    </div>
  );
}
