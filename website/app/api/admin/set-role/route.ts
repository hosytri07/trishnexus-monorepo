/**
 * POST /api/admin/set-role - Phase 11.8.5 + Phase 38.7 (demo support).
 *
 * Body JSON: { uid, role, demoDays? }
 * Header: Authorization: Bearer <Firebase ID token>
 *
 * Flow:
 *  1. Verify ID token. Caller must be admin (custom claim or Firestore role).
 *  2. Set custom claim auth.setCustomUserClaims(uid, { admin: role === 'admin' }).
 *  3. Update Firestore /users/{uid} (role + plan + demo metadata).
 *  4. Audit log to /audit.
 */
import { type NextRequest } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, adminDb, adminReady } from '@/lib/firebase-admin';
import { corsJson, corsOptions } from '@/lib/cors';
import { sendEmailFireAndForget } from '@/lib/email-sender';
import { roleChangeEmail } from '@/lib/email-templates';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const OPTIONS = corsOptions;

interface Body {
  uid?: string;
  role?: string;
  demoDays?: number;
}

const DEMO_DAYS_DEFAULT = 30;
const DEMO_DAYS_MAX = 365;

async function verifyCaller(req: NextRequest) {
  const authz = req.headers.get('authorization') ?? '';
  const token = authz.startsWith('Bearer ') ? authz.slice(7) : null;
  if (!token) return { error: 'missing_token', status: 401 } as const;
  try {
    const decoded = await adminAuth().verifyIdToken(token);
    if (decoded.admin === true) {
      return { decoded } as const;
    }
    const snap = await adminDb().collection('users').doc(decoded.uid).get();
    if (snap.exists && (snap.data() as { role?: string }).role === 'admin') {
      return { decoded } as const;
    }
    return { error: 'not_admin', status: 403 } as const;
  } catch (e) {
    console.error('[set-role] verify fail:', e);
    return { error: 'invalid_token', status: 401 } as const;
  }
}

export async function POST(req: NextRequest) {
  if (!adminReady()) {
    return corsJson(
      { error: 'Admin SDK not configured' },
      { status: 501 },
    );
  }

  const caller = await verifyCaller(req);
  if ('error' in caller) {
    return corsJson({ error: caller.error }, { status: caller.status });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return corsJson({ error: 'invalid_json' }, { status: 400 });
  }
  const uid = body.uid?.trim();
  const role =
    body.role === 'admin'
      ? 'admin'
      : body.role === 'user'
        ? 'user'
        : body.role === 'demo'
          ? 'demo'
          : body.role === 'trial'
            ? 'trial'
            : null;
  if (!uid || !role) {
    return corsJson({ error: 'missing_fields' }, { status: 400 });
  }
  if (uid === caller.decoded.uid && role !== 'admin') {
    return corsJson(
      { error: 'cannot_demote_self' },
      { status: 422 },
    );
  }

  let demoExpiresAt: number | null = null;
  if (role === 'demo') {
    const reqDays = Number(body.demoDays);
    const days =
      Number.isFinite(reqDays) && reqDays > 0
        ? Math.min(Math.floor(reqDays), DEMO_DAYS_MAX)
        : DEMO_DAYS_DEFAULT;
    demoExpiresAt = Date.now() + days * 86_400_000;
  }

  try {
    const auth = adminAuth();
    const db = adminDb();

    const existing = await auth.getUser(uid).catch(() => null);
    if (!existing) {
      return corsJson({ error: 'user_not_found' }, { status: 404 });
    }
    const claims = { ...(existing.customClaims ?? {}), admin: role === 'admin' };
    await auth.setCustomUserClaims(uid, claims);

    const planMap: Record<string, string> = {
      admin: 'Admin',
      user: 'Pro',
      demo: 'Demo',
      trial: 'Trial',
    };
    const update: Record<string, unknown> = {
      role,
      plan: planMap[role] ?? 'Free',
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (role === 'demo' && demoExpiresAt !== null) {
      update.demo_expires_at = demoExpiresAt;
      update.demo_set_by_uid = caller.decoded.uid;
      update.demo_set_at = Date.now();
    } else {
      update.demo_expires_at = FieldValue.delete();
      update.demo_set_by_uid = FieldValue.delete();
      update.demo_set_at = FieldValue.delete();
    }
    // Đọc role cũ trước khi ghi (cho audit + email)
    const existingUserSnap = await db.collection('users').doc(uid).get();
    const oldRole = existingUserSnap.exists
      ? (existingUserSnap.data() as { role?: string; display_name?: string }).role
      : undefined;
    const userDisplayName = existingUserSnap.exists
      ? (existingUserSnap.data() as { display_name?: string }).display_name
      : undefined;

    await db.collection('users').doc(uid).set(update, { merge: true });

    // Phase 39 — Gửi email notify user (fire-and-forget, không block API)
    if (existing.email) {
      const { subject, html } = roleChangeEmail({
        userEmail: existing.email,
        userName: userDisplayName ?? existing.displayName ?? undefined,
        newRole: role,
        oldRole,
        demoExpiresAt: demoExpiresAt ?? undefined,
        demoDays: role === 'demo' && demoExpiresAt
          ? Math.round((demoExpiresAt - Date.now()) / 86_400_000)
          : undefined,
      });
      sendEmailFireAndForget({
        to: existing.email,
        subject,
        html,
      });
    }

    await db.collection('audit').add({
      action: 'set_role',
      actor: caller.decoded.uid,
      actorEmail: caller.decoded.email ?? null,
      target: uid,
      targetEmail: existing.email ?? null,
      newRole: role,
      demoExpiresAt: demoExpiresAt,
      createdAt: FieldValue.serverTimestamp(),
    });

    return corsJson({
      ok: true,
      uid,
      role,
      demo_expires_at: demoExpiresAt,
      note: 'Target user must logout-login to refresh ID token claim.',
    });
  } catch (e) {
    console.error('[set-role] fail:', e);
    return corsJson(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
