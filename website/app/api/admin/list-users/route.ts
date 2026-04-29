/**
 * GET /api/admin/list-users — Phase 19.22.
 *
 * List user từ Firebase Auth (nguồn thật) + merge với Firestore /users/{uid}
 * doc nếu có. Lý do: nhiều user tạo thẳng từ Firebase Console hoặc đăng ký
 * trên app khác → chưa có Firestore doc → query Firestore client-side
 * không thấy được. Endpoint này dùng Admin SDK để lấy đầy đủ.
 *
 * Header: Authorization: Bearer <Firebase ID token>
 * Query:  ?max=1000 (optional, default 1000, cap 1000)
 *
 * Response: { users: [{ uid, email, displayName, phoneNumber, photoURL,
 *   emailVerified, disabled, createdAt, lastSignedIn, providers,
 *   firestore: { role, plan, fullName, phone, ... } | null }] }
 */
import { NextResponse, type NextRequest } from 'next/server';
import { adminAuth, adminDb, adminReady } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
    console.error('[list-users] verify fail:', e);
    return { error: 'invalid_token', status: 401 } as const;
  }
}

export async function GET(req: NextRequest) {
  if (!adminReady()) {
    return NextResponse.json(
      { error: 'Admin SDK chưa cấu hình. Set FIREBASE_SERVICE_ACCOUNT hoặc GOOGLE_APPLICATION_CREDENTIALS env.' },
      { status: 501 },
    );
  }

  const caller = await verifyAdmin(req);
  if ('error' in caller) {
    return NextResponse.json({ error: caller.error }, { status: caller.status });
  }

  const url = new URL(req.url);
  const maxRaw = Number(url.searchParams.get('max') ?? '1000');
  const max = Math.min(Math.max(1, isNaN(maxRaw) ? 1000 : maxRaw), 1000);

  try {
    const auth = adminAuth();
    const db = adminDb();

    // 1. List Firebase Auth users
    const list = await auth.listUsers(max);

    // 2. Batch fetch Firestore docs (max 10 per `in` query → split)
    const uids = list.users.map((u) => u.uid);
    const firestoreMap = new Map<string, Record<string, unknown>>();
    const chunkSize = 10;
    for (let i = 0; i < uids.length; i += chunkSize) {
      const chunk = uids.slice(i, i + chunkSize);
      if (chunk.length === 0) continue;
      const snaps = await Promise.all(
        chunk.map((uid) => db.collection('users').doc(uid).get()),
      );
      snaps.forEach((s, idx) => {
        if (s.exists) firestoreMap.set(chunk[idx]!, s.data() as Record<string, unknown>);
      });
    }

    // 3. Merge
    const users = list.users.map((u) => {
      const fs = firestoreMap.get(u.uid) ?? null;
      return {
        uid: u.uid,
        email: u.email ?? null,
        displayName: u.displayName ?? null,
        phoneNumber: u.phoneNumber ?? null,
        photoURL: u.photoURL ?? null,
        emailVerified: u.emailVerified,
        disabled: u.disabled,
        createdAt: u.metadata.creationTime
          ? new Date(u.metadata.creationTime).getTime()
          : null,
        lastSignedIn: u.metadata.lastSignInTime
          ? new Date(u.metadata.lastSignInTime).getTime()
          : null,
        providers: u.providerData.map((p) => p.providerId),
        customClaims: u.customClaims ?? null,
        firestore: fs
          ? {
              role: (fs.role as string) ?? 'trial',
              plan: (fs.plan as string) ?? null,
              fullName: (fs.fullName as string) ?? null,
              phone: (fs.phone as string) ?? null,
              display_name: (fs.display_name as string) ?? null,
              key_activated_at: (fs.key_activated_at as number) ?? 0,
              activated_key_id: (fs.activated_key_id as string) ?? null,
            }
          : null,
      };
    });

    return NextResponse.json({
      users,
      total: users.length,
      truncated: list.pageToken != null,
    });
  } catch (e) {
    console.error('[list-users] fail:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
