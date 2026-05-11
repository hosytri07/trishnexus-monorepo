/**
 * POST /api/promo/activate — Phase 38.8.
 *
 * User submit promo code (readable, shared, vd "TRIAL2026") → backend verify
 * + upgrade role=demo + log usage. Mỗi user dùng 1 code 1 lần.
 *
 * Body JSON: { code: string }
 * Header:    Authorization: Bearer <Firebase ID token>
 *
 * Flow:
 *  1. Verify ID token → lấy uid caller.
 *  2. Normalize code (uppercase, trim).
 *  3. Đọc /promo_codes/{CODE} → check active, expires_at, quota.
 *  4. Đọc /users/{uid} → check activated_codes (chống dùng lại), role hợp lệ.
 *  5. Atomic write (transaction): user role/demo_expires_at/activated_codes + promo activation_count.
 *  6. Audit log.
 *
 * Response:
 *  200 { ok: true, role: 'demo', demo_expires_at, duration_days }
 *  4xx { error: 'invalid_code'|'inactive'|'expired'|'quota_reached'|'already_used'|'role_blocked' }
 */
import { type NextRequest } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, adminDb, adminReady } from '@/lib/firebase-admin';
import { corsJson, corsOptions } from '@/lib/cors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const OPTIONS = corsOptions;

interface Body {
  code?: string;
}

/** Hợp lệ: A-Z 0-9, độ dài 4-32 ký tự (sau khi normalize). */
const CODE_PATTERN = /^[A-Z0-9]{4,32}$/;

function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[\s-]/g, '');
}

async function verifyCaller(req: NextRequest) {
  const authz = req.headers.get('authorization') ?? '';
  const token = authz.startsWith('Bearer ') ? authz.slice(7) : null;
  if (!token) return { error: 'missing_token', status: 401 } as const;
  try {
    const decoded = await adminAuth().verifyIdToken(token);
    return { decoded } as const;
  } catch (e) {
    console.error('[promo/activate] verify fail:', e);
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
  const uid = caller.decoded.uid;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return corsJson({ error: 'invalid_json' }, { status: 400 });
  }
  const rawCode = body.code?.trim();
  if (!rawCode) {
    return corsJson({ error: 'missing_code' }, { status: 400 });
  }
  const code = normalizeCode(rawCode);
  if (!CODE_PATTERN.test(code)) {
    return corsJson({ error: 'invalid_format' }, { status: 400 });
  }

  const db = adminDb();
  const promoRef = db.collection('promo_codes').doc(code);
  const userRef = db.collection('users').doc(uid);

  try {
    const result = await db.runTransaction(async (tx) => {
      const promoSnap = await tx.get(promoRef);
      if (!promoSnap.exists) {
        return { ok: false, error: 'invalid_code', status: 404 } as const;
      }
      const promo = promoSnap.data() as {
        active?: boolean;
        action?: string;
        duration_days?: number;
        activation_count?: number;
        max_activations?: number;
        expires_at?: number;
      };
      if (promo.active === false) {
        return { ok: false, error: 'inactive', status: 403 } as const;
      }
      if (typeof promo.expires_at === 'number' && promo.expires_at > 0 && promo.expires_at < Date.now()) {
        return { ok: false, error: 'expired', status: 403 } as const;
      }
      if (
        typeof promo.max_activations === 'number' &&
        promo.max_activations > 0 &&
        (promo.activation_count ?? 0) >= promo.max_activations
      ) {
        return { ok: false, error: 'quota_reached', status: 429 } as const;
      }
      if (promo.action !== 'demo') {
        return { ok: false, error: 'unsupported_action', status: 500 } as const;
      }
      const durationDays = Number(promo.duration_days);
      if (!Number.isFinite(durationDays) || durationDays < 1 || durationDays > 365) {
        return { ok: false, error: 'invalid_duration', status: 500 } as const;
      }

      const userSnap = await tx.get(userRef);
      if (!userSnap.exists) {
        return { ok: false, error: 'user_not_found', status: 404 } as const;
      }
      const user = userSnap.data() as {
        role?: string;
        activated_codes?: string[];
        demo_expires_at?: number;
      };

      // Mỗi user 1 lần / code
      if ((user.activated_codes ?? []).includes(code)) {
        return { ok: false, error: 'already_used', status: 409 } as const;
      }

      // Chặn admin / user (không cần promo, tránh downgrade)
      if (user.role === 'admin' || user.role === 'user') {
        return { ok: false, error: 'role_blocked', status: 403 } as const;
      }

      // Nếu demo còn hạn dài hơn duration → từ chối (tránh giảm thời gian)
      const nowMs = Date.now();
      const newExpiry = nowMs + durationDays * 86_400_000;
      if (
        user.role === 'demo' &&
        typeof user.demo_expires_at === 'number' &&
        user.demo_expires_at > newExpiry
      ) {
        return { ok: false, error: 'demo_still_longer', status: 409 } as const;
      }

      // OK — apply
      tx.set(
        userRef,
        {
          role: 'demo',
          plan: 'Demo',
          demo_expires_at: newExpiry,
          demo_set_by_uid: `promo:${code}`,
          demo_set_at: nowMs,
          activated_codes: FieldValue.arrayUnion(code),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      tx.update(promoRef, {
        activation_count: FieldValue.increment(1),
        last_activated_at: nowMs,
      });
      return {
        ok: true,
        role: 'demo' as const,
        demo_expires_at: newExpiry,
        duration_days: durationDays,
      } as const;
    });

    if (!result.ok) {
      return corsJson({ error: result.error }, { status: result.status });
    }

    // Custom claim không cần đổi (demo không có claim admin) — chỉ Firestore.
    // Audit log (best effort, không transaction để không block)
    void db.collection('audit').add({
      action: 'promo.activate',
      actor: uid,
      actorEmail: caller.decoded.email ?? null,
      target: uid,
      promoCode: code,
      newRole: result.role,
      demoExpiresAt: result.demo_expires_at,
      durationDays: result.duration_days,
      createdAt: FieldValue.serverTimestamp(),
    });

    return corsJson({
      ok: true,
      role: result.role,
      demo_expires_at: result.demo_expires_at,
      duration_days: result.duration_days,
      note: 'Demo đã kích hoạt — đăng nhập lại app để cập nhật quyền truy cập.',
    });
  } catch (e) {
    console.error('[promo/activate] fail:', e);
    return corsJson(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
