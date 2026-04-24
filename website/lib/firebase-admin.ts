/**
 * Firebase Admin SDK wrapper — server-only — Phase 11.8.5.
 *
 * Được các API route ở `app/api/admin/*` dùng để verify ID token của
 * caller + thực hiện thao tác đặc quyền (setCustomUserClaims, xoá user...).
 *
 * Cấu hình credential (ưu tiên từ trên xuống):
 *   1. `FIREBASE_SERVICE_ACCOUNT` env — JSON base64 hoặc JSON string
 *      (Vercel secret). Dùng cho production.
 *   2. `GOOGLE_APPLICATION_CREDENTIALS` env — đường dẫn file JSON
 *      (dev local, trỏ tới ./secrets/service-account.json).
 *   3. Application default credentials (khi chạy trên GCP / App Engine).
 *
 * Nếu không có credential nào → `adminReady = false`, API route trả về
 * 501 và UI tự fallback chỉ update Firestore doc (xem /admin/users).
 *
 * Chỉ import từ server (API route / Route Handler). Không dùng ở client.
 */
import 'server-only';
import {
  cert,
  getApps,
  initializeApp,
  applicationDefault,
  type App,
} from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import * as fs from 'node:fs';

function parseServiceAccount(raw: string): Record<string, unknown> | null {
  try {
    // Thử decode base64 trước (cho Vercel paste gọn).
    if (!raw.trim().startsWith('{')) {
      const decoded = Buffer.from(raw, 'base64').toString('utf8');
      if (decoded.trim().startsWith('{')) {
        return JSON.parse(decoded);
      }
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error('[firebase-admin] parseServiceAccount fail:', e);
    return null;
  }
}

let _app: App | null = null;
let _ready = false;

function initAdmin(): App | null {
  if (_app) return _app;
  if (getApps().length > 0) {
    _app = getApps()[0]!;
    _ready = true;
    return _app;
  }
  try {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (raw) {
      const sa = parseServiceAccount(raw);
      if (sa) {
        _app = initializeApp({
          credential: cert(sa as Parameters<typeof cert>[0]),
        });
        _ready = true;
        return _app;
      }
    }
    const pathCred = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (pathCred && fs.existsSync(pathCred)) {
      const sa = JSON.parse(fs.readFileSync(pathCred, 'utf8'));
      _app = initializeApp({ credential: cert(sa) });
      _ready = true;
      return _app;
    }
    // Thử ADC (GCP)
    _app = initializeApp({ credential: applicationDefault() });
    _ready = true;
    return _app;
  } catch (e) {
    console.warn('[firebase-admin] init skipped:', e);
    _app = null;
    _ready = false;
    return null;
  }
}

export function adminReady(): boolean {
  initAdmin();
  return _ready;
}

export function adminAuth(): Auth {
  const app = initAdmin();
  if (!app) throw new Error('Firebase Admin SDK chưa cấu hình');
  return getAuth(app);
}

export function adminDb(): Firestore {
  const app = initAdmin();
  if (!app) throw new Error('Firebase Admin SDK chưa cấu hình');
  return getFirestore(app);
}
