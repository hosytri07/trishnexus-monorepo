'use client';

/**
 * Firebase client init — Phase 11.6.1.
 *
 * Cấu hình đọc từ biến môi trường `NEXT_PUBLIC_FIREBASE_*`. Khi chưa set
 * (ví dụ dev local chưa tạo project), module trả về {app:null, auth:null,
 * db:null} và `useAuthContext` sẽ tự fallback sang mock role switcher —
 * giữ behavior cũ của dev.
 *
 * .env.local cần các biến:
 *   NEXT_PUBLIC_FIREBASE_API_KEY
 *   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
 *   NEXT_PUBLIC_FIREBASE_PROJECT_ID
 *   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
 *   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
 *   NEXT_PUBLIC_FIREBASE_APP_ID
 *
 * Hướng dẫn lấy: Firebase Console → Project settings → General → Your apps
 * → Web app → Config snippet (copy từng giá trị).
 */
import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/**
 * firebaseReady — true nếu tất cả 6 biến env đã set (đủ để init Firebase).
 * UI dùng flag này để quyết định show auth thật hay fallback mock.
 */
export const firebaseReady = Boolean(
  config.apiKey &&
    config.authDomain &&
    config.projectId &&
    config.appId &&
    config.messagingSenderId &&
    config.storageBucket,
);

let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _db: Firestore | null = null;

if (firebaseReady) {
  _app = getApps().length ? getApp() : initializeApp(config);
  _auth = getAuth(_app);
  _db = getFirestore(_app);
}

export const app: FirebaseApp | null = _app;
export const auth: Auth | null = _auth;
export const db: Firestore | null = _db;

/** Narrow-type helper: throw nếu gọi auth mà firebaseReady=false. */
export function requireAuth(): Auth {
  if (!_auth) {
    throw new Error(
      'Firebase Auth chưa cấu hình. Thêm NEXT_PUBLIC_FIREBASE_* vào .env.local, restart dev.',
    );
  }
  return _auth;
}

export function requireDb(): Firestore {
  if (!_db) {
    throw new Error(
      'Firestore chưa cấu hình. Thêm NEXT_PUBLIC_FIREBASE_* vào .env.local, restart dev.',
    );
  }
  return _db;
}
