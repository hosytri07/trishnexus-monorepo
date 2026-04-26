/**
 * @trishteam/auth — User profile + key activation.
 *
 * Phase 16.1.b/e. Load profile từ Firestore, update display name, activate
 * key (Trial → User).
 */

import {
  doc,
  getDoc,
  query,
  collection,
  where,
  limit,
  getDocs,
  runTransaction,
} from 'firebase/firestore';
import {
  type TrishUser,
  type ActivationKey,
  paths,
} from '@trishteam/data';
import { getFirebaseDb } from './firebase-app.js';

/** Load TrishUser doc by UID. Trả null nếu chưa có. */
export async function loadProfile(uid: string): Promise<TrishUser | null> {
  const db = getFirebaseDb();
  const snap = await getDoc(doc(db, paths.user(uid)));
  if (!snap.exists()) return null;
  return snap.data() as TrishUser;
}

/** Update các field bình thường (KHÔNG thay role — Firestore rule chặn). */
export async function updateProfile(
  uid: string,
  patch: Partial<Pick<TrishUser, 'display_name' | 'photo_url'>>,
): Promise<void> {
  const db = getFirebaseDb();
  await runTransaction(db, async (tx) => {
    const ref = doc(db, paths.user(uid));
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Profile không tồn tại');
    tx.update(ref, patch);
  });
}

// ============================================================
// Activate key (Trial → User)
// ============================================================

export type ActivateKeyResult =
  | { success: true; activatedKeyId: string }
  | { success: false; error: 'invalid' | 'used' | 'revoked' | 'expired' | 'unknown'; message: string };

/**
 * User nhập mã key. Validate + flip role Trial → User trong 1 transaction.
 *
 * Flow:
 *   1. Query keys collection by `code` field.
 *   2. Validate status === 'active', expires_at = 0 hoặc > now.
 *   3. Transaction: update key { status: 'used', used_by_uid, used_at }
 *      + update user { role: 'user', key_activated_at, activated_key_id }.
 *
 * Trả về result success / error.
 */
export async function activateKey(
  uid: string,
  code: string,
): Promise<ActivateKeyResult> {
  try {
    const db = getFirebaseDb();
    const trimmed = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!trimmed) {
      return { success: false, error: 'invalid', message: 'Mã key không được rỗng' };
    }
    if (trimmed.length !== 16) {
      return {
        success: false,
        error: 'invalid',
        message: 'Mã key phải đúng 16 ký tự (chữ hoa + số)',
      };
    }

    // Firestore rules yêu cầu query filter status='active' (xem note ở
    // website/app/profile/page.tsx).
    const q = query(
      collection(db, paths.keys()),
      where('code', '==', trimmed),
      where('status', '==', 'active'),
      limit(1),
    );
    const snap = await getDocs(q);
    if (snap.empty) {
      return {
        success: false,
        error: 'invalid',
        message: 'Mã key không tồn tại hoặc đã được sử dụng',
      };
    }
    const keyDoc = snap.docs[0]!;
    const keyData = keyDoc.data() as ActivationKey;
    if (keyData.expires_at > 0 && keyData.expires_at < Date.now()) {
      return { success: false, error: 'expired', message: 'Mã key đã hết hạn' };
    }

    await runTransaction(db, async (tx) => {
      const userRef = doc(db, paths.user(uid));
      const keyRef = doc(db, paths.key(keyDoc.id));

      const userSnap = await tx.get(userRef);
      const freshKeySnap = await tx.get(keyRef);
      if (!userSnap.exists()) throw new Error('User không tồn tại');
      if (!freshKeySnap.exists()) throw new Error('Key không tồn tại');
      const freshKey = freshKeySnap.data() as ActivationKey;
      if (freshKey.status !== 'active') {
        throw new Error('Key đã bị dùng giữa chừng');
      }

      const now = Date.now();
      tx.update(keyRef, {
        status: 'used',
        used_by_uid: uid,
        used_at: now,
      });
      tx.update(userRef, {
        role: 'user',
        key_activated_at: now,
        activated_key_id: keyDoc.id,
      });
    });
    return { success: true, activatedKeyId: keyDoc.id };
  } catch (err) {
    console.error('[trishteam-auth] activateKey fail', err);
    return {
      success: false,
      error: 'unknown',
      message: err instanceof Error ? err.message : String(err),
    };
  }
}
