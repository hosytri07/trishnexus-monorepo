/**
 * POST /api/admin/set-role — Phase 11.8.5.
 *
 * Body JSON: { uid: string, role: 'user' | 'admin' }
 * Header:    Authorization: Bearer <Firebase ID token>
 *
 * Flow:
 *   1. Verify ID token (firebase-admin). Caller phải là admin
 *      (custom claim `admin:true` hoặc doc /users/{caller}.role === 'admin').
 *   2. Set custom claim:
 *        auth.setCustomUserClaims(uid, { admin: role === 'admin' })
 *      → ID token của target sẽ có claim mới ở lần refresh tiếp theo.
 *   3. Update Firestore /users/{uid} để UI đọc được ngay.
 *
 * Nếu Admin SDK chưa config → 501 (UI tự fallback chỉ update Firestore).
 *
 * Lưu ý bảo mật:
 *   - Không cho admin tự gỡ quyền của chính mình (422).
 *   - Luôn log vào /audit/{autoId} để giữ chain of custody.
 */
import { type NextRequest } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, adminDb, adminReady } from '@/lib/firebase-admin';
import { corsJson, corsOptions } from '@/lib/cors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const OPTIONS = corsOptions;

interface Body {
  uid?: string;
  role?: string;
}

async function verifyCaller(req: NextRequest) {
  const authz = req.headers.get('authorization') ?? '';
  const token = authz.startsWith('Bearer ') ? authz.slice(7) : null;
  if (!token) return { error: 'missing_token', status: 401 } as const;
  try {
    const decoded = await adminAuth().verifyIdToken(token);
    // Admin = custom claim OR role trong Firestore.
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
      {
        error:
          'Admin SDK chưa cấu hình. Set FIREBASE_SERVICE_ACCOUNT env hoặc dùng seed-admin.ts CLI.',
      },
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

  try {
    const auth = adminAuth();
    const db = adminDb();

    // 1. Set custom claim
    const existing = await auth.getUser(uid).catch(() => null);
    if (!existing) {
      return corsJson({ error: 'user_not_found' }, { status: 404 });
    }
    const claims = { ...(existing.customClaims ?? {}), admin: role === 'admin' };
    await auth.setCustomUserClaims(uid, claims);

    // 2. Update Firestore doc
    const planMap: Record<string, string> = {
      admin: 'Admin',
      user: 'Pro',
      trial: 'Trial',
    };
    await db.collection('users').doc(uid).set(
      {
        role,
        plan: planMap[role] ?? 'Free',
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    // 3. Audit log
    await db.collection('audit').add({
      action: 'set_role',
      actor: caller.decoded.uid,
      actorEmail: caller.decoded.email ?? null,
      target: uid,
      targetEmail: existing.email ?? null,
      newRole: role,
      createdAt: FieldValue.serverTimestamp(),
    });

    return corsJson({
      ok: true,
      uid,
      role,
      note: 'Target user cần logout-login để ID token refresh claim.',
    });
  } catch (e) {
    console.error('[set-role] fail:', e);
    return corsJson(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
