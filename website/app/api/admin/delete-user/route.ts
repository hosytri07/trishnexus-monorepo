/**
 * POST /api/admin/delete-user — Phase 19.22.
 *
 * Body JSON: { uid: string }
 * Header:    Authorization: Bearer <Firebase ID token>
 *
 * Flow:
 *   1. Verify caller là admin.
 *   2. Không cho admin tự xóa chính mình (422).
 *   3. Xóa Firebase Auth user.
 *   4. Xóa Firestore /users/{uid} doc (best-effort).
 *   5. Audit log /audit/{autoId}.
 */
import { type NextRequest } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, adminDb, adminReady } from '@/lib/firebase-admin';
import { corsJson, corsOptions } from '@/lib/cors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const OPTIONS = corsOptions;

async function verifyAdmin(req: NextRequest) {
  const authz = req.headers.get('authorization') ?? '';
  const token = authz.startsWith('Bearer ') ? authz.slice(7) : null;
  if (!token) return { error: 'missing_token', status: 401 } as const;
  try {
    const decoded = await adminAuth().verifyIdToken(token);
    if (decoded.admin === true) return { decoded } as const;
    const snap = await adminDb()
      .collection('users')
      .doc(decoded.uid)
      .get();
    if (snap.exists && (snap.data() as { role?: string }).role === 'admin') {
      return { decoded } as const;
    }
    return { error: 'not_admin', status: 403 } as const;
  } catch (e) {
    console.error('[delete-user] verify fail:', e);
    return { error: 'invalid_token', status: 401 } as const;
  }
}

export async function POST(req: NextRequest) {
  if (!adminReady()) {
    return corsJson(
      { error: 'Admin SDK chưa cấu hình.' },
      { status: 501 },
    );
  }

  const caller = await verifyAdmin(req);
  if ('error' in caller) {
    return corsJson({ error: caller.error }, { status: caller.status });
  }

  let body: { uid?: string };
  try {
    body = (await req.json()) as { uid?: string };
  } catch {
    return corsJson({ error: 'invalid_json' }, { status: 400 });
  }
  const uid = body.uid?.trim();
  if (!uid) {
    return corsJson({ error: 'missing_uid' }, { status: 400 });
  }
  if (uid === caller.decoded.uid) {
    return corsJson(
      { error: 'cannot_delete_self' },
      { status: 422 },
    );
  }

  try {
    const auth = adminAuth();
    const db = adminDb();

    // Lookup target trước để có email cho audit
    const target = await auth.getUser(uid).catch(() => null);
    if (!target) {
      return corsJson({ error: 'user_not_found' }, { status: 404 });
    }
    const targetEmail = target.email ?? null;

    // 1. Xóa Auth
    await auth.deleteUser(uid);

    // 2. Xóa Firestore doc (best-effort)
    try {
      await db.collection('users').doc(uid).delete();
    } catch (e) {
      console.warn('[delete-user] delete Firestore doc fail (non-fatal):', e);
    }

    // 3. Audit log
    await db.collection('audit').add({
      action: 'delete_user',
      actor: caller.decoded.uid,
      actorEmail: caller.decoded.email ?? null,
      target: uid,
      targetEmail,
      createdAt: FieldValue.serverTimestamp(),
    });

    return corsJson({ ok: true, uid, email: targetEmail });
  } catch (e) {
    console.error('[delete-user] fail:', e);
    return corsJson(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
