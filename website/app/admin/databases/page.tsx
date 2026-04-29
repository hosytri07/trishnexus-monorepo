'use client';

/**
 * /admin/databases — Phase 19.22.
 *
 * Quản lý 4 collection database hardcode đã migrate sang Firestore:
 *   /standards (QCVN/TCVN/Thông tư...) · /dinh_muc (định mức)
 *   /vat_lieu (vật liệu) · /roads_vn (đường VN)
 *
 * Features:
 *   - Show count hiện tại của mỗi collection
 *   - Nút "Seed từ TS" (chỉ thêm doc thiếu, không ghi đè)
 *   - Nút "Reseed (overwrite)" (force ghi đè — cẩn thận)
 *   - Link Firestore Console deep-link (admin sửa nội dung trực tiếp)
 */
import { useEffect, useState } from 'react';
import {
  Database,
  Loader2,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Upload,
  RotateCw,
} from 'lucide-react';
import { collection, getCountFromServer } from 'firebase/firestore';
import { getIdToken } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { useConfirm } from '@/components/confirm-modal';

interface DbInfo {
  id: 'standards' | 'dinh_muc' | 'vat_lieu' | 'roads_vn';
  label: string;
  description: string;
  icon: string;
  expectedCount: number;
  userPage: string;
  count: number | null;
  loading: boolean;
}

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? 'trishteam-17c2d';

export default function AdminDatabasesPage() {
  const [ConfirmDialog, askConfirm] = useConfirm();
  const [dbs, setDbs] = useState<DbInfo[]>([
    {
      id: 'standards',
      label: 'Quy chuẩn / TCVN',
      description: '19 văn bản QCVN, TCVN, Thông tư, Nghị định, Quyết định ngành XD-GT.',
      icon: '📚',
      expectedCount: 19,
      userPage: '/quy-chuan',
      count: null,
      loading: true,
    },
    {
      id: 'dinh_muc',
      label: 'Định mức + Đơn giá',
      description: '17 mã định mức QĐ 1776/2007 (đào đắp, bê tông, cốt thép, xây trát...).',
      icon: '📐',
      expectedCount: 17,
      userPage: '/dinh-muc',
      count: null,
      loading: true,
    },
    {
      id: 'vat_lieu',
      label: 'Vật liệu XD',
      description: '25 loại vật liệu xây dựng phổ thông + thông số kỹ thuật.',
      icon: '🧱',
      expectedCount: 25,
      userPage: '/vat-lieu',
      count: null,
      loading: true,
    },
    {
      id: 'roads_vn',
      label: 'Đường Việt Nam',
      description: '25 tuyến quốc lộ + cao tốc chính.',
      icon: '🛣️',
      expectedCount: 25,
      userPage: '/duong-vn',
      count: null,
      loading: true,
    },
  ]);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; tone: 'ok' | 'err' } | null>(null);

  function flash(tone: 'ok' | 'err', text: string) {
    setToast({ text, tone });
    setTimeout(() => setToast(null), 4500);
  }

  async function loadCounts() {
    if (!db) return;
    setDbs((prev) => prev.map((d) => ({ ...d, loading: true })));
    await Promise.all(
      dbs.map(async (d) => {
        try {
          const snap = await getCountFromServer(collection(db!, d.id));
          const n = snap.data().count;
          setDbs((prev) =>
            prev.map((x) => (x.id === d.id ? { ...x, count: n, loading: false } : x)),
          );
        } catch (e) {
          console.warn(`[admin/databases] count fail for ${d.id}:`, e);
          setDbs((prev) =>
            prev.map((x) => (x.id === d.id ? { ...x, count: 0, loading: false } : x)),
          );
        }
      }),
    );
  }

  useEffect(() => {
    void loadCounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function seed(collectionId: string | 'all', overwrite: boolean) {
    if (overwrite) {
      const ok = await askConfirm({
        title: 'Reseed (overwrite)',
        message: `Ghi đè ${collectionId === 'all' ? 'TẤT CẢ collection' : collectionId} bằng data từ TS file. Mọi chỉnh sửa thủ công của admin sẽ bị mất.`,
        okLabel: 'Reseed',
        danger: true,
      });
      if (!ok) return;
    }
    if (!auth?.currentUser) {
      flash('err', 'Bạn chưa đăng nhập.');
      return;
    }
    setBusy(`${collectionId}-${overwrite ? 'overwrite' : 'seed'}`);
    try {
      const idToken = await getIdToken(auth.currentUser);
      const res = await fetch('/api/admin/seed-databases', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ collection: collectionId, overwrite }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        report?: Record<string, { total: number; created: number; skipped: number; updated: number }>;
        error?: string;
      };
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      const labelMap: Record<string, string> = {
        standards: 'Quy chuẩn',
        dinh_muc: 'Định mức',
        vat_lieu: 'Vật liệu',
        roads_vn: 'Đường VN',
      };
      const summary = Object.entries(body.report ?? {})
        .map(([k, v]) => `${labelMap[k] ?? k}: thêm ${v.created} mới · cập nhật ${v.updated} · bỏ qua ${v.skipped}`)
        .join(' | ');
      flash('ok', `Nạp dữ liệu xong! ${summary}`);
      await loadCounts();
    } catch (e) {
      flash('err', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      <ConfirmDialog />

      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1
            className="text-2xl font-bold flex items-center gap-2"
            style={{ color: 'var(--color-text-primary)' }}
          >
            <Database size={22} /> Cơ sở dữ liệu Việt Nam
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            4 bộ dữ liệu. Lần đầu bấm "Nạp tất cả" để đưa dữ liệu lên Firebase. Sau đó sửa nội dung qua Firebase Console (link bên dưới).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void loadCounts()}
            className="inline-flex items-center gap-1.5 h-10 px-3 rounded-md text-xs font-medium"
            style={{
              background: 'var(--color-surface-muted)',
              color: 'var(--color-text-secondary)',
              border: '1px solid var(--color-border-subtle)',
            }}
          >
            <RefreshCw size={13} /> Làm mới
          </button>
          <button
            onClick={() => void seed('all', false)}
            disabled={!!busy}
            className="inline-flex items-center gap-1.5 h-10 px-3 rounded-md text-xs font-bold disabled:opacity-50"
            style={{ background: 'var(--color-accent-gradient)', color: '#fff' }}
          >
            {busy === 'all-seed' ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
            Nạp tất cả
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
          {toast.tone === 'ok' ? <CheckCircle2 size={14} className="inline mr-1.5" /> : <AlertTriangle size={14} className="inline mr-1.5" />}
          {toast.text}
        </div>
      ) : null}

      {/* Cards 4 collection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {dbs.map((d) => {
          const status =
            d.count === null
              ? 'loading'
              : d.count === 0
                ? 'empty'
                : d.count < d.expectedCount
                  ? 'partial'
                  : 'ok';
          const statusColor =
            status === 'ok' ? '#10B981' : status === 'partial' ? '#F59E0B' : status === 'empty' ? '#EF4444' : '#9CA3AF';
          const statusLabel =
            status === 'ok'
              ? '✓ Đã có đủ dữ liệu'
              : status === 'partial'
                ? `⚠ Thiếu ${d.expectedCount - (d.count ?? 0)} bản ghi`
                : status === 'empty'
                  ? '✗ Chưa có dữ liệu'
                  : '...';

          return (
            <div
              key={d.id}
              className="rounded-xl border p-5"
              style={{
                background: 'var(--color-surface-primary)',
                borderColor: 'var(--color-border-default)',
                borderLeftWidth: 3,
                borderLeftColor: statusColor,
              }}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{d.icon}</span>
                  <div>
                    <h3 className="text-base font-bold" style={{ color: 'var(--color-text-primary)' }}>
                      {d.label}
                    </h3>
                    <p className="text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>
                      /{d.id}
                    </p>
                  </div>
                </div>
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded"
                  style={{ background: statusColor + '22', color: statusColor }}
                >
                  {statusLabel}
                </span>
              </div>

              <p className="text-sm mb-3" style={{ color: 'var(--color-text-secondary)' }}>
                {d.description}
              </p>

              <div className="flex items-center gap-3 mb-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                <span>
                  Trên cloud: <strong style={{ color: 'var(--color-text-primary)' }}>{d.loading ? '...' : d.count ?? 0}</strong>
                </span>
                <span>·</span>
                <span>
                  Có sẵn trong code: <strong style={{ color: 'var(--color-text-primary)' }}>{d.expectedCount}</strong>
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => void seed(d.id, false)}
                  disabled={!!busy}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded text-xs font-bold disabled:opacity-50"
                  style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent-primary)' }}
                  title="Chỉ thêm bản ghi chưa có. Giữ nguyên các bản ghi đã chỉnh sửa thủ công."
                >
                  {busy === `${d.id}-seed` ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />}
                  Nạp dữ liệu mới (giữ bản đã sửa)
                </button>
                <button
                  onClick={() => void seed(d.id, true)}
                  disabled={!!busy}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded text-xs font-bold disabled:opacity-50"
                  style={{
                    background: 'rgba(239,68,68,0.08)',
                    color: '#B91C1C',
                    border: '1px solid rgba(239,68,68,0.25)',
                  }}
                  title="Cẩn thận: ghi đè toàn bộ — mất chỉnh sửa thủ công."
                >
                  {busy === `${d.id}-overwrite` ? <Loader2 size={11} className="animate-spin" /> : <RotateCw size={11} />}
                  Khôi phục mặc định (ghi đè)
                </button>
                <a
                  href={`https://console.firebase.google.com/u/9/project/${PROJECT_ID}/firestore/databases/-default-/data/~2F${d.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded text-xs font-medium"
                  style={{
                    background: 'var(--color-surface-muted)',
                    color: 'var(--color-text-secondary)',
                    border: '1px solid var(--color-border-subtle)',
                  }}
                >
                  <ExternalLink size={11} /> Mở Firebase Console
                </a>
                <a
                  href={d.userPage}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded text-xs font-medium"
                  style={{
                    background: 'var(--color-surface-muted)',
                    color: 'var(--color-text-secondary)',
                    border: '1px solid var(--color-border-subtle)',
                  }}
                >
                  <ExternalLink size={11} /> Xem trang công khai
                </a>
              </div>
            </div>
          );
        })}
      </div>

      <div
        className="rounded-md p-4 text-sm space-y-2"
        style={{
          background: 'var(--color-surface-muted)',
          color: 'var(--color-text-secondary)',
          border: '1px solid var(--color-border-subtle)',
        }}
      >
        <p>
          <strong style={{ color: 'var(--color-text-primary)' }}>💡 Hướng dẫn sử dụng:</strong>
        </p>
        <ol className="list-decimal pl-5 space-y-1">
          <li>
            <strong>Lần đầu cài đặt:</strong> bấm <em>"Nạp tất cả"</em> ở góc trên bên phải để đưa dữ liệu mặc định lên Firebase Cloud.
          </li>
          <li>
            <strong>Khi cần sửa nội dung:</strong> bấm <em>"Mở Firebase Console"</em> ở mỗi thẻ → sửa từng bản ghi trực tiếp (giao diện Google, đầy đủ trường).
          </li>
          <li>
            <strong>Khi có bản cập nhật mới (do em thêm vào code):</strong> bấm <em>"Nạp dữ liệu mới (giữ bản đã sửa)"</em> — chỉ thêm bản ghi mới, KHÔNG ghi đè những gì anh đã chỉnh sửa.
          </li>
          <li>
            <strong>Khi muốn reset về trạng thái ban đầu:</strong> bấm <em>"Khôi phục mặc định (ghi đè)"</em> — cẩn thận, sẽ mất tất cả chỉnh sửa thủ công.
          </li>
        </ol>
        <p className="text-xs pt-2" style={{ color: 'var(--color-text-muted)' }}>
          Các trang công khai (/quy-chuan, /dinh-muc, /vat-lieu, /duong-vn) tự động lấy dữ liệu từ Firebase. Nếu Firebase trống, sẽ tự dùng dữ liệu mặc định trong code — đảm bảo trang luôn hiển thị.
        </p>
      </div>
    </div>
  );
}
