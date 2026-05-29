/**
 * /api/newsletter — Phase 78.6 newsletter subscribe API.
 *
 * STUB hiện tại: validate email + log. TODO wire Resend list API hoặc Firestore.
 * Có thể thêm `RESEND_API_KEY` env var + create audience qua Resend dashboard
 * → POST /audiences/:id/contacts để add subscriber.
 */
import { NextResponse } from 'next/server';

const EMAIL_REGEX = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;

export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    if (typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
      return NextResponse.json({ error: 'Email không hợp lệ' }, { status: 400 });
    }

    const normalized = email.trim().toLowerCase();

    // TODO: wire to Resend Audience API
    // const resp = await fetch(`https://api.resend.com/audiences/${AUDIENCE_ID}/contacts`, {
    //   method: 'POST',
    //   headers: {
    //     Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify({ email: normalized, unsubscribed: false }),
    // });

    console.log(`[newsletter] subscribe: ${normalized}`);

    // Best-effort log to Firestore (nếu có Firebase Admin SDK config)
    // try {
    //   const { admin } = await import('@/lib/firebase-admin');
    //   await admin.firestore().collection('newsletter_subscribers').doc(normalized).set({
    //     email: normalized,
    //     created_at: admin.firestore.FieldValue.serverTimestamp(),
    //   });
    // } catch (err) {
    //   console.warn('[newsletter] firestore log fail', err);
    // }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
