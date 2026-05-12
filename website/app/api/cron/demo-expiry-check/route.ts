/**
 * GET /api/cron/demo-expiry-check — Phase 39 cron daily.
 *
 * Vercel Cron gọi mỗi ngày 9h sáng VN (cron "0 2 * * *" UTC).
 *
 * Logic:
 *  1. Query users với role='demo' và demo_expires_at trong [now, now + 7d].
 *  2. Với mỗi user: nếu chưa gửi email cho ngày này (tracked qua field
 *     `demo_reminder_last_sent_at`) → send + cập nhật field.
 *  3. Skip user có `demo_reminder_disabled: true` (admin tắt notify).
 *
 * Bảo mật: chỉ Vercel Cron gọi được (header `x-vercel-cron-signature` có sẵn),
 * hoặc cho phép Bearer token với env CRON_SECRET.
 */
import { type NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb, adminReady } from '@/lib/firebase-admin';
import { sendEmail } from '@/lib/email-sender';
import { demoExpiringEmail } from '@/lib/email-templates';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // tới 60s — đủ cho 200-500 user

const REMINDER_THRESHOLD_DAYS = 7;
const ONE_DAY_MS = 86_400_000;

function isAuthorized(req: NextRequest): boolean {
  // Vercel Cron tự inject header này (xem docs)
  const cronHeader = req.headers.get('x-vercel-cron-signature');
  if (cronHeader) return true;

  // Manual trigger qua Bearer token (test)
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const authz = req.headers.get('authorization') ?? '';
  const token = authz.startsWith('Bearer ') ? authz.slice(7) : null;
  return token === secret;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (!adminReady()) {
    return NextResponse.json(
      { error: 'admin SDK not configured' },
      { status: 501 },
    );
  }

  const now = Date.now();
  const upperBound = now + REMINDER_THRESHOLD_DAYS * ONE_DAY_MS;
  const todayKey = new Date(now).toISOString().slice(0, 10); // YYYY-MM-DD

  const db = adminDb();

  try {
    // Query demo users sắp hết hạn
    const snap = await db
      .collection('users')
      .where('role', '==', 'demo')
      .where('demo_expires_at', '>', now)
      .where('demo_expires_at', '<=', upperBound)
      .get();

    const candidates = snap.docs.filter((d) => {
      const data = d.data() as {
        demo_reminder_disabled?: boolean;
        demo_reminder_last_sent_key?: string;
      };
      if (data.demo_reminder_disabled === true) return false;
      // Đã gửi trong ngày này — skip (cron có thể chạy duplicate)
      if (data.demo_reminder_last_sent_key === todayKey) return false;
      return true;
    });

    let sent = 0;
    let failed = 0;
    const errors: Array<{ uid: string; error: string }> = [];

    for (const doc of candidates) {
      const data = doc.data() as {
        email?: string;
        display_name?: string;
        demo_expires_at?: number;
      };
      if (!data.email || !data.demo_expires_at) continue;

      const daysLeft = Math.ceil((data.demo_expires_at - now) / ONE_DAY_MS);

      const { subject, html } = demoExpiringEmail({
        userEmail: data.email,
        userName: data.display_name,
        demoExpiresAt: data.demo_expires_at,
        daysLeft,
      });

      const res = await sendEmail({
        to: data.email,
        subject,
        html,
      });

      if (res.ok) {
        sent++;
        // Cập nhật field để skip lần chạy sau cùng ngày
        await doc.ref.update({
          demo_reminder_last_sent_key: todayKey,
          demo_reminder_last_sent_at: now,
        });
      } else {
        failed++;
        errors.push({ uid: doc.id, error: res.error ?? 'unknown' });
      }
    }

    // Audit log
    await db.collection('audit').add({
      action: 'cron.demo_expiry_check',
      actor: 'system',
      sent,
      failed,
      candidates: candidates.length,
      todayKey,
      errors: errors.slice(0, 10), // cap để doc không quá lớn
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      ok: true,
      date: todayKey,
      total_candidates: candidates.length,
      sent,
      failed,
      ...(errors.length > 0 ? { errors: errors.slice(0, 5) } : {}),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[cron/demo-expiry-check] fail:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
