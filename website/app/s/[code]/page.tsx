/**
 * /s/[code] — Phase 19.22.
 *
 * Redirect endpoint cho URL shortener. Server component, fetch Firestore
 * /short_links/{code} qua Admin SDK → 302 redirect tới original_url +
 * tăng click_count async (không block redirect).
 *
 * Nếu code không tồn tại → render 404 với link về dashboard.
 */
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { adminDb, adminReady } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface PageProps {
  params: { code: string };
}

interface ShortLinkData {
  code: string;
  original_url: string;
  created_at: number;
  created_by_uid: string | null;
  click_count: number;
}

export default async function ShortLinkRedirectPage({ params }: PageProps) {
  const code = params.code?.trim().toLowerCase();
  if (!code || !/^[a-z0-9]{4,12}$/.test(code)) {
    return <NotFoundView code={params.code} />;
  }

  if (!adminReady()) {
    return <NotFoundView code={code} reason="Admin SDK chưa cấu hình" />;
  }

  try {
    const db = adminDb();
    const ref = db.collection('short_links').doc(code);
    const snap = await ref.get();
    if (!snap.exists) {
      return <NotFoundView code={code} />;
    }
    const data = snap.data() as ShortLinkData;
    if (!data?.original_url) {
      return <NotFoundView code={code} />;
    }

    // Tăng click_count (best-effort, không block)
    void ref.update({ click_count: FieldValue.increment(1) }).catch((e) => {
      console.warn('[shorten/redirect] increment fail:', e);
    });

    redirect(data.original_url);
  } catch (e) {
    // redirect() throws NEXT_REDIRECT — re-throw
    if ((e as { digest?: string })?.digest?.startsWith?.('NEXT_REDIRECT')) {
      throw e;
    }
    console.error('[shorten/redirect] fail:', e);
    return <NotFoundView code={code} reason={e instanceof Error ? e.message : String(e)} />;
  }
}

function NotFoundView({ code, reason }: { code: string; reason?: string }) {
  return (
    <main className="max-w-lg mx-auto px-6 py-20 text-center">
      <div
        className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4"
        style={{ background: 'rgba(239,68,68,0.15)' }}
      >
        <AlertTriangle size={32} style={{ color: '#EF4444' }} />
      </div>
      <h1
        className="text-2xl font-bold mb-2"
        style={{ color: 'var(--color-text-primary)' }}
      >
        Link không tồn tại
      </h1>
      <p
        className="text-sm mb-1"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        Mã <code className="font-mono">{code}</code> không có trong hệ thống.
      </p>
      {reason ? (
        <p className="text-xs mb-4" style={{ color: 'var(--color-text-muted)' }}>
          {reason}
        </p>
      ) : (
        <p className="text-xs mb-4" style={{ color: 'var(--color-text-muted)' }}>
          Có thể link đã hết hạn hoặc bị xóa.
        </p>
      )}
      <Link
        href="/"
        className="inline-flex items-center gap-2 px-4 h-10 rounded-md text-sm font-bold"
        style={{
          background: 'var(--color-accent-gradient)',
          color: '#ffffff',
        }}
      >
        <ArrowLeft size={14} /> Về Dashboard
      </Link>
    </main>
  );
}
