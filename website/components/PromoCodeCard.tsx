'use client';

/**
 * PromoCodeCard — Phase 38.8.
 *
 * Card form ở /dashboard cho user nhập promo code (vd "TRIAL2026") để upgrade
 * role=demo. Sau khi success → reload page để fetch profile mới.
 *
 * Dùng auth.currentUser.getIdToken() trực tiếp từ Firebase Auth SDK.
 */

import { useState } from 'react';
import { Ticket, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { auth } from '@/lib/firebase';

interface Props {
  onSuccess?: () => void;
}

const ERROR_LABEL: Record<string, string> = {
  missing_token: 'Chưa đăng nhập — vui lòng đăng nhập lại.',
  invalid_token: 'Phiên đăng nhập hết hạn.',
  missing_code: 'Vui lòng nhập mã.',
  invalid_format: 'Mã không hợp lệ (4-32 ký tự, chỉ chữ và số).',
  invalid_code: 'Mã không tồn tại.',
  inactive: 'Mã đã bị tạm ngưng.',
  expired: 'Mã đã hết hạn.',
  quota_reached: 'Mã đã đủ số lượt kích hoạt.',
  already_used: 'Bạn đã dùng mã này rồi.',
  role_blocked: 'Tài khoản đã là User/Admin — không cần dùng mã.',
  demo_still_longer: 'Demo hiện tại còn dài hơn mã này.',
  user_not_found: 'Tài khoản chưa được khởi tạo.',
};

export function PromoCodeCard({ onSuccess }: Props): JSX.Element {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<
    | { kind: 'success'; days: number; expiresAt: number }
    | { kind: 'error'; message: string }
    | null
  >(null);

  async function handleSubmit(): Promise<void> {
    if (loading) return;
    const normalized = code.trim().toUpperCase().replace(/[\s-]/g, '');
    if (!normalized) {
      setResult({ kind: 'error', message: 'Vui lòng nhập mã.' });
      return;
    }
    if (!auth?.currentUser) {
      setResult({ kind: 'error', message: 'Chưa đăng nhập.' });
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch('/api/promo/activate', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: normalized }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.ok) {
        setResult({
          kind: 'success',
          days: body.duration_days ?? 0,
          expiresAt: body.demo_expires_at ?? 0,
        });
        setTimeout(() => {
          if (onSuccess) onSuccess();
          else window.location.reload();
        }, 2000);
      } else {
        const errCode = body.error ?? `http_${res.status}`;
        setResult({
          kind: 'error',
          message: ERROR_LABEL[errCode] ?? `Lỗi: ${errCode}`,
        });
      }
    } catch (e) {
      setResult({
        kind: 'error',
        message: `Lỗi mạng: ${e instanceof Error ? e.message : String(e)}`,
      });
    } finally {
      setLoading(false);
    }
  }

  const success = result?.kind === 'success';

  return (
    <section className="mb-8">
      <h2 className="text-xl font-bold mb-3 flex items-center gap-2">
        <Ticket size={18} /> Mã khuyến mãi / dùng thử
      </h2>
      <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/30 p-4">
        <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">
          Nhập mã admin/marketing cấp (vd <code className="font-mono">TRIAL2026</code>) để kích
          hoạt bản dùng thử (Demo) các app TrishTEAM. Mỗi mã chỉ dùng 1 lần / tài khoản.
        </p>
        <div className="flex gap-2 flex-wrap">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleSubmit();
            }}
            placeholder="VD: TRIAL2026"
            maxLength={32}
            disabled={loading || success}
            className="flex-1 min-w-[180px] px-3 py-2 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm font-mono tracking-wider uppercase outline-none focus:border-emerald-500 disabled:opacity-60"
          />
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={loading || !code.trim() || success}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-md"
          >
            {loading ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Đang xử lý…
              </>
            ) : (
              <>
                <Ticket size={14} /> Kích hoạt
              </>
            )}
          </button>
        </div>

        {result?.kind === 'success' && (
          <div className="mt-3 p-3 rounded-md bg-emerald-100 dark:bg-emerald-900/40 border border-emerald-300 dark:border-emerald-700 text-sm text-emerald-800 dark:text-emerald-200 inline-flex items-start gap-2">
            <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" />
            <div>
              Kích hoạt thành công! Bạn có <strong>{result.days} ngày</strong> dùng thử, hết hạn{' '}
              <strong>{new Date(result.expiresAt).toLocaleString('vi-VN')}</strong>.
              <div className="text-xs mt-1 opacity-80">🔄 Đang tải lại trang…</div>
            </div>
          </div>
        )}
        {result?.kind === 'error' && (
          <div className="mt-3 p-3 rounded-md bg-rose-100 dark:bg-rose-900/40 border border-rose-300 dark:border-rose-700 text-sm text-rose-800 dark:text-rose-200 inline-flex items-start gap-2">
            <XCircle size={16} className="mt-0.5 flex-shrink-0" />
            <span>{result.message}</span>
          </div>
        )}
      </div>
    </section>
  );
}
