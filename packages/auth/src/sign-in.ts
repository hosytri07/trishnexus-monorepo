/**
 * @trishteam/auth — Sign in / sign up / sign out helpers.
 *
 * Phase 16.1.b. Email + Password + Google OAuth.
 * Tự động tạo user doc trong Firestore (`/users/{uid}`) khi register.
 * Default role = 'trial' — user phải nhập key để upgrade thành 'user'.
 */

import {
  type User as FirebaseUser,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut as firebaseSignOut,
  updateProfile as updateFirebaseProfile,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { paths, type TrishUser } from '@trishteam/data';
import { getFirebaseAuth, getFirebaseDb } from './firebase-app.js';

// ============================================================
// Email + password
// ============================================================

export async function signInWithEmail(
  email: string,
  password: string,
): Promise<FirebaseUser> {
  const cred = await signInWithEmailAndPassword(
    getFirebaseAuth(),
    email,
    password,
  );
  // Phase 16.2.d — Đảm bảo Firestore doc tồn tại. Trường hợp user được tạo
  // bằng Firebase Console (admin tools) bypass signUp flow → chưa có doc.
  await ensureUserDoc(cred.user, 'password');
  return cred.user;
}

export interface SignUpInput {
  email: string;
  password: string;
  displayName: string;
}

/**
 * Đăng ký email/password. Tự gửi email verification.
 * Tạo user doc với role = 'trial' nếu chưa có.
 */
export async function signUpWithEmail(input: SignUpInput): Promise<FirebaseUser> {
  const auth = getFirebaseAuth();
  const cred = await createUserWithEmailAndPassword(
    auth,
    input.email,
    input.password,
  );
  await updateFirebaseProfile(cred.user, {
    displayName: input.displayName,
  });
  await ensureUserDoc(cred.user, 'password');
  // Send verification email (best-effort)
  try {
    await sendEmailVerification(cred.user);
  } catch (err) {
    console.warn('[trishteam-auth] sendEmailVerification fail:', err);
  }
  return cred.user;
}

export async function sendResetPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(getFirebaseAuth(), email);
}

// ============================================================
// Google OAuth
// ============================================================

export async function signInWithGoogle(): Promise<FirebaseUser> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const cred = await signInWithPopup(getFirebaseAuth(), provider);
  await ensureUserDoc(cred.user, 'google.com');
  await touchLastLogin(cred.user.uid);
  return cred.user;
}

/**
 * Phase 14.4.10 — Tauri-friendly Google login (redirect cùng cửa sổ).
 *
 * Trong Tauri WebView2, signInWithPopup bị chặn cross-origin.
 * Dùng signInWithRedirect thay thế: WebView2 navigate sang accounts.google.com
 * → user chọn account → Google redirect về Firebase handler
 * → handler redirect về Tauri origin → app load lại + getRedirectResult.
 *
 * YÊU CẦU: Firebase Console → Authentication → Settings → Authorized Domains
 * phải có: `localhost`, `tauri.localhost`.
 */
export async function signInWithGoogleRedirect(): Promise<void> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  await signInWithRedirect(getFirebaseAuth(), provider);
  // Hàm này KHÔNG return — page sẽ navigate sang Google ngay.
}

/**
 * Gọi khi app mount để hoàn tất flow signInWithRedirect.
 * Firebase tự kiểm tra URL hash + lấy token nếu vừa redirect về.
 * Trả null nếu không có pending redirect.
 */
export async function handleGoogleRedirectResult(): Promise<FirebaseUser | null> {
  try {
    const result = await getRedirectResult(getFirebaseAuth());
    if (result?.user) {
      await ensureUserDoc(result.user, 'google.com');
      await touchLastLogin(result.user.uid);
      return result.user;
    }
    return null;
  } catch (err) {
    console.warn('[trishteam-auth] handleGoogleRedirectResult fail', err);
    return null;
  }
}

// ============================================================
// Sign out
// ============================================================

export async function signOut(): Promise<void> {
  await firebaseSignOut(getFirebaseAuth());
}

// ============================================================
// Ensure /users/{uid} doc exists with role 'trial'
// Public — auth-state.ts dùng để self-heal khi user tạo qua Console.
// ============================================================

export async function ensureUserDoc(
  user: FirebaseUser,
  provider: 'password' | 'google.com',
): Promise<void> {
  const db = getFirebaseDb();
  const ref = doc(db, paths.user(user.uid));
  const snap = await getDoc(ref);
  if (snap.exists()) {
    // Update last_login + provider nếu khác
    const existing = snap.data() as Partial<TrishUser>;
    const updates: Partial<TrishUser> = {
      last_login_at: Date.now(),
    };
    if (!existing.provider) updates.provider = provider;
    if (!existing.photo_url && user.photoURL) updates.photo_url = user.photoURL;
    // Cast `any` vì DocumentReference<DocumentData> không generic theo TrishUser;
    // Firebase updateDoc dùng UpdateData<DocumentData> = { [k]: FieldValue | Partial<unknown> | undefined }
    // mà 'unknown' không assign vào constraint đó. Runtime hoàn toàn đúng.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await updateDoc(ref, updates as any);
    return;
  }
  // Create new user doc — default role 'trial'
  const now = Date.now();
  const userDoc: TrishUser = {
    id: user.uid,
    email: user.email ?? '',
    display_name: user.displayName ?? user.email?.split('@')[0] ?? 'User',
    role: 'trial',
    photo_url: user.photoURL ?? undefined,
    provider,
    key_activated_at: 0,
    created_at: now,
    last_login_at: now,
  };
  await setDoc(ref, {
    ...userDoc,
    // server-side timestamp cho audit
    _server_created_at: serverTimestamp(),
  });
}

async function touchLastLogin(uid: string): Promise<void> {
  try {
    const db = getFirebaseDb();
    await updateDoc(doc(db, paths.user(uid)), {
      last_login_at: Date.now(),
    });
  } catch (err) {
    console.warn('[trishteam-auth] touchLastLogin fail:', err);
  }
}
