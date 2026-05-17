'use client';

/**
 * /admin/atgt-blocks-zip — Phase 43 wave 12.3.
 *
 * Web upload zip đã bị bỏ. Upload zip block ATGT giờ chỉ qua TrishAdmin desktop
 * (GitHub Release thay vì Firebase Storage).
 */

import Link from 'next/link';

export default function AdminAtgtBlocksZipPage() {
  return (
    <div style={{ padding: 40, maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 16 }}>
        📦 ATGT Blocks ZIP — Đã chuyển sang TrishAdmin desktop
      </h1>
      <p style={{ color: '#6b7280', fontSize: 14, lineHeight: 1.6 }}>
        Upload zip block ATGT giờ thực hiện qua <strong>TrishAdmin desktop app</strong> (private),
        upload lên <strong>GitHub Release</strong> thay vì Firebase Storage.
      </p>
      <p style={{ color: '#6b7280', fontSize: 14, marginTop: 12 }}>
        Mở TrishAdmin → sidebar → "📦 ATGT Blocks ZIP" → paste GitHub PAT → chọn file zip → Upload.
      </p>
      <div style={{ marginTop: 24 }}>
        <Link href="/admin/atgt-blocks" style={{
          padding: '10px 20px',
          background: '#10b981',
          color: '#fff',
          borderRadius: 6,
          fontSize: 14,
          fontWeight: 600,
          textDecoration: 'none',
        }}>← Quay lại 🚸 ATGT Blocks</Link>
      </div>
    </div>
  );
}
