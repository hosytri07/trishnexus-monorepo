/**
 * AppFooterCredit — thanh credit chạy marquee chậm ở đáy app.
 *
 * Dùng chung cho TrishWork / TrishUtilities / TrishFinance. Chữ trôi ngang
 * chậm, tự dừng khi rê chuột. Mỏng, màu mờ — không phân tâm khi làm việc.
 *
 *   <AppFooterCredit />                       // dùng text mặc định
 *   <AppFooterCredit text="..." speedSec={40} />
 *   <AppFooterCredit db={getFirebaseDb()} />  // đọc config realtime, admin sửa được
 *
 * Config Firestore: doc `app_config/footer_credit` = { text, speedSec, enabled }.
 * Admin sửa qua TrishAdmin → mọi app cập nhật ngay (onSnapshot). Thiếu doc → dùng mặc định.
 */

import { useEffect, useState } from 'react';
import { doc, onSnapshot, type Firestore } from 'firebase/firestore';

export interface AppFooterCreditProps {
  /** Nội dung credit (mặc định / fallback khi không có Firestore). */
  text?: string;
  /** Thời gian 1 vòng chạy (giây) — càng lớn càng chậm. */
  speedSec?: number;
  /** Nếu truyền → đọc config realtime từ `app_config/footer_credit`. */
  db?: Firestore | null;
}

const DEFAULT_TEXT =
  '© 2026 TrishTEAM — Phát triển bởi Trí — Góp ý tại website hoặc liên hệ trishteam.official@gmail.com — Phần mềm không có mục đích thương mại, nên vui lòng không đem ra mua bán, mọi sự ủng hộ xin gửi vào các quỹ từ thiện của Chính phủ. Xin cảm ơn!';

export function AppFooterCredit({
  text = DEFAULT_TEXT,
  speedSec = 45,
  db = null,
}: AppFooterCreditProps = {}): JSX.Element | null {
  const [cfg, setCfg] = useState<{ text?: string; speedSec?: number; enabled?: boolean }>({});

  useEffect(() => {
    if (!db) return;
    const ref = doc(db, 'app_config', 'footer_credit');
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) setCfg(snap.data() as typeof cfg);
      },
      () => {/* lỗi đọc → giữ mặc định */},
    );
    return () => unsub();
  }, [db]);

  if (cfg.enabled === false) return null;
  const effText = (cfg.text && cfg.text.trim()) || text;
  const effSpeed = cfg.speedSec && cfg.speedSec > 0 ? cfg.speedSec : speedSec;
  return renderBar(effText, effSpeed);
}

function renderBar(text: string, speedSec: number): JSX.Element {
  return (
    <div className="tt-footer-credit">
      <style>{`
        .tt-footer-credit {
          flex: 0 0 auto;
          width: 100%;
          height: 26px;
          overflow: hidden;
          display: flex;
          align-items: center;
          border-top: 1px solid var(--color-border-soft, rgba(255,255,255,0.08));
          background: var(--color-surface-2, rgba(0,0,0,0.18));
          user-select: none;
        }
        .tt-footer-track {
          display: inline-flex;
          flex-wrap: nowrap;
          white-space: nowrap;
          will-change: transform;
          animation: tt-footer-marquee ${speedSec}s linear infinite;
        }
        .tt-footer-credit:hover .tt-footer-track {
          animation-play-state: paused;
        }
        .tt-footer-seg {
          padding: 0 40px;
          font-size: 12.5px;
          font-weight: 500;
          letter-spacing: 0.2px;
          color: var(--color-text-secondary, #c9d1d9);
        }
        @keyframes tt-footer-marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
      <div className="tt-footer-track">
        <span className="tt-footer-seg">{text}</span>
        <span className="tt-footer-seg" aria-hidden="true">{text}</span>
      </div>
    </div>
  );
}
