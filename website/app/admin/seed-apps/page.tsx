'use client';

/**
 * /admin/seed-apps — Trigger /api/admin/seed-apps-meta qua UI (Phase 39.2).
 *
 * Click button → page tự lấy Firebase ID token + POST endpoint → hiển thị log.
 * Tránh phải dùng curl + paste token thủ công.
 */

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { auth, firebaseReady } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';

interface SeedResponse {
  ok?: boolean;
  added?: number;
  updated?: number;
  skipped?: number;
  total_apps?: number;
  schema_version?: number;
  log?: string[];
  error?: string;
  message?: string;
  detail?: string;
}

export default function SeedAppsPage(): JSX.Element {
  const { role, loading: authLoading } = useAuth();
  const [busy, setBusy] = useState(false);
  const [response, setResponse] = useState<SeedResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSeed(): Promise<void> {
    if (!firebaseReady || !auth) {
      setError('Firebase chưa sẵn sàng');
      return;
    }
    const user = auth.currentUser;
    if (!user) {
      setError('Chưa đăng nhập');
      return;
    }
    setBusy(true);
    setError(null);
    setResponse(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/admin/seed-apps-meta', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json()) as SeedResponse;
      setResponse(data);
      if (!res.ok) {
        setError(data.error ?? `HTTP ${res.status}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (authLoading) {
    return (
      <div className="p-8">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  if (role !== 'admin') {
    return (
      <div className="max-w-2xl mx-auto p-8">
        <div className="rounded-lg border border-rose-300 bg-rose-50 p-6">
          <AlertCircle className="text-rose-600 mb-2" />
          <h2 className="text-xl font-bold text-rose-900">Truy cập bị chặn</h2>
          <p className="text-rose-800 mt-2">Chỉ admin được phép truy cập.</p>
          <Link href="/" className="text-rose-700 underline mt-4 inline-block">
            ← Về trang chủ
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="mb-4">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft size={14} /> Admin
        </Link>
      </div>

      <h1 className="text-2xl font-bold mb-2">📦 Seed apps_meta</h1>
      <p className="text-sm text-slate-600 mb-6">
        Bulk import <code>apps-registry.json</code> → Firestore{' '}
        <code>/apps_meta</code>. Sau khi seed, <code>/downloads</code> page tự
        hiển thị 11 apps với metadata mới (Phase 36.1: <code>requires_key</code>{' '}
        + <code>key_type</code>).
      </p>

      <button
        type="button"
        onClick={() => void handleSeed()}
        disabled={busy}
        className="px-5 py-2.5 rounded-md bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-sm font-semibold inline-flex items-center gap-2"
      >
        {busy ? (
          <>
            <Loader2 size={16} className="animate-spin" /> Đang seed…
          </>
        ) : (
          <>📦 Trigger seed apps_meta</>
        )}
      </button>

      {error && (
        <div className="mt-4 p-3 rounded-md bg-rose-50 border border-rose-200 text-sm text-rose-700">
          ⚠ {error}
        </div>
      )}

      {response && response.ok && (
        <div className="mt-6 space-y-3">
          <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 flex items-start gap-3">
            <CheckCircle2 className="text-emerald-600 mt-0.5" size={20} />
            <div>
              <div className="font-semibold text-emerald-900">
                Seed thành công!
              </div>
              <div className="text-sm text-emerald-800 mt-1">
                Schema v{response.schema_version} · Tổng{' '}
                <strong>{response.total_apps}</strong> apps.{' '}
                <strong>{response.added}</strong> tạo mới ·{' '}
                <strong>{response.updated}</strong> cập nhật ·{' '}
                <strong>{response.skipped}</strong> bỏ qua (deprecated).
              </div>
              <div className="text-xs text-emerald-700 mt-2">
                💡 /downloads page sẽ refresh sau ~5 phút (Vercel CDN cache) hoặc
                bypass cache bằng Ctrl+F5.
              </div>
            </div>
          </div>
          {response.log && response.log.length > 0 && (
            <details className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <summary className="font-semibold text-sm cursor-pointer">
                Log chi tiết ({response.log.length} dòng)
              </summary>
              <pre className="mt-2 text-xs overflow-x-auto whitespace-pre-wrap">
                {response.log.join('\n')}
              </pre>
            </details>
          )}
        </div>
      )}

      {response && !response.ok && (
        <div className="mt-4 p-3 rounded-md bg-rose-50 border border-rose-200 text-sm text-rose-700">
          <strong>{response.error}</strong>
          {response.message && <div>{response.message}</div>}
          {response.detail && (
            <pre className="text-xs mt-1 overflow-x-auto">{response.detail}</pre>
          )}
        </div>
      )}
    </div>
  );
}
