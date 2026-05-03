/**
 * @trishteam/admin-keys — Firestore CRUD + onSnapshot.
 *
 * Phase 28.8 (2026-05-03).
 *
 * Schema:
 *   /admin_settings/{tenantId}
 *     /api_keys/{provider}     { encrypted, updatedAt, modifiedBy, modifiedByEmail, version }
 *     /audit_log/{autoId}      { provider, action, modifiedBy, modifiedByEmail, timestamp, note? }
 *
 * Provider IDs hiện có:
 *   - 'groq'    (Llama 3.3 70B + Vision)
 *   - 'claude'  (Anthropic API)
 *   (mở rộng sau: 'openai', 'gemini', 'deepseek', ...)
 *
 * Tenant ID: default 'default'. Multi-tenant lookup qua TrishUser.tenant_id
 * (sẽ thêm vào @trishteam/data sau).
 */

import {
  doc,
  collection,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  addDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { getFirebaseDb } from '@trishteam/auth';
import { encryptApiKey, decryptApiKey } from './crypto.js';

export type ApiKeyProvider = 'groq' | 'gemini' | 'claude' | 'tg_feedback_bot' | 'tg_feedback_chat' | 'tg_lisp_chat';

/** Default AI providers shown in UI. Claude ẩn vì paid. */
export const DEFAULT_PROVIDERS: ApiKeyProvider[] = ['groq', 'gemini'];

/** All AI providers including paid + Telegram config. Use for sync + advanced UI. */
export const ALL_PROVIDERS: ApiKeyProvider[] = ['groq', 'gemini', 'claude', 'tg_feedback_bot', 'tg_feedback_chat', 'tg_lisp_chat'];

/** Telegram feedback config providers (admin only — for góp ý form). */
export const FEEDBACK_PROVIDERS: ApiKeyProvider[] = ['tg_feedback_bot', 'tg_feedback_chat'];

/** Telegram channel cho TrishTEAM AutoLISP curated library. Reuse tg_feedback_bot token. */
export const LISP_LIBRARY_PROVIDERS: ApiKeyProvider[] = ['tg_lisp_chat'];

export const PROVIDER_LABEL: Record<ApiKeyProvider, string> = {
  groq: '⚡ Groq (free — Llama 3.3 70B + Vision)',
  gemini: '✨ Gemini (free — Gemini 2.0 Flash + Vision)',
  claude: '🔑 Claude (paid — Anthropic)',
  tg_feedback_bot: '📨 Telegram Bot Token (chung cho góp ý + LISP library)',
  tg_feedback_chat: '📨 Telegram Chat/Channel ID (góp ý)',
  tg_lisp_chat: '🧩 Telegram Channel ID (AutoLISP TrishTEAM library)',
};

export const PROVIDER_PLACEHOLDER: Record<ApiKeyProvider, string> = {
  groq: 'gsk_xxx... · console.groq.com',
  gemini: 'AIza... · aistudio.google.com',
  claude: 'sk-ant-xxx... · console.anthropic.com',
  tg_feedback_bot: '1234567890:AAEh...',
  tg_feedback_chat: '-1001234567890 hoặc @channelname',
  tg_lisp_chat: '-1001234567890 hoặc @lisp_lib',
};

export const PROVIDER_FREE: Record<ApiKeyProvider, boolean> = {
  groq: true,
  gemini: true,
  claude: false,
  tg_feedback_bot: true,
  tg_feedback_chat: true,
  tg_lisp_chat: true,
};

export interface ApiKeyDoc {
  /** AES-GCM ciphertext base64 */
  encrypted: string;
  /** ms timestamp */
  updatedAt: number;
  /** UID admin sửa key */
  modifiedBy: string;
  /** Email admin (cho audit dễ đọc) */
  modifiedByEmail: string;
  /** Schema version (hiện tại = 1) */
  version: number;
}

export interface AuditLogEntry {
  id: string;
  provider: ApiKeyProvider;
  action: 'set' | 'delete';
  modifiedBy: string;
  modifiedByEmail: string;
  /** ms timestamp */
  timestamp: number;
  note?: string;
}

// ============================================================
// Path helpers
// ============================================================

export const DEFAULT_TENANT_ID = 'default';

export const adminKeyPaths = {
  apiKey: (tenant: string, provider: ApiKeyProvider) =>
    `admin_settings/${tenant}/api_keys/${provider}`,
  apiKeys: (tenant: string) => `admin_settings/${tenant}/api_keys`,
  auditLog: (tenant: string) => `admin_settings/${tenant}/audit_log`,
} as const;

// ============================================================
// CRUD API keys
// ============================================================

/**
 * Admin lưu API key (encrypt → Firestore).
 * Empty key → delete doc.
 * Tự động ghi audit log entry.
 */
export async function saveApiKey(
  tenant: string,
  provider: ApiKeyProvider,
  plaintext: string,
  modifiedBy: string,
  modifiedByEmail: string,
): Promise<void> {
  const db = getFirebaseDb();
  const ref = doc(db, adminKeyPaths.apiKey(tenant, provider));

  if (!plaintext.trim()) {
    // Empty → delete + log
    await deleteDoc(ref);
    await logKeyChange(tenant, provider, 'delete', modifiedBy, modifiedByEmail);
    return;
  }

  const encrypted = await encryptApiKey(plaintext);
  const data: ApiKeyDoc = {
    encrypted,
    updatedAt: Date.now(),
    modifiedBy,
    modifiedByEmail,
    version: 1,
  };
  await setDoc(ref, data);
  await logKeyChange(tenant, provider, 'set', modifiedBy, modifiedByEmail);
}

/**
 * Load 1 API key đã decrypt. Trả empty string nếu không có hoặc lỗi.
 */
export async function loadApiKey(
  tenant: string,
  provider: ApiKeyProvider,
): Promise<string> {
  try {
    const db = getFirebaseDb();
    const snap = await getDoc(doc(db, adminKeyPaths.apiKey(tenant, provider)));
    if (!snap.exists()) return '';
    const data = snap.data() as ApiKeyDoc;
    return await decryptApiKey(data.encrypted);
  } catch (err) {
    console.error('[admin-keys] loadApiKey fail', provider, err);
    return '';
  }
}

/**
 * Load tất cả API keys cho tenant. Trả map { provider: plaintext }.
 */
export async function loadAllApiKeys(
  tenant: string,
): Promise<Record<ApiKeyProvider, string>> {
  const result: Record<ApiKeyProvider, string> = { groq: '', gemini: '', claude: '', tg_feedback_bot: '', tg_feedback_chat: '', tg_lisp_chat: '' };
  const db = getFirebaseDb();
  const snap = await getDocs(collection(db, adminKeyPaths.apiKeys(tenant)));
  for (const docSnap of snap.docs) {
    const provider = docSnap.id as ApiKeyProvider;
    if (!ALL_PROVIDERS.includes(provider)) continue;
    try {
      const data = docSnap.data() as ApiKeyDoc;
      result[provider] = await decryptApiKey(data.encrypted);
    } catch (err) {
      console.error('[admin-keys] decrypt fail', provider, err);
    }
  }
  return result;
}

/**
 * Listen realtime tất cả API keys. callback nhận map { provider: plaintext }.
 * Trả unsubscribe function.
 */
export function subscribeApiKeys(
  tenant: string,
  callback: (keys: Record<ApiKeyProvider, string>) => void,
): Unsubscribe {
  const db = getFirebaseDb();
  return onSnapshot(
    collection(db, adminKeyPaths.apiKeys(tenant)),
    async (snap) => {
      const result: Record<ApiKeyProvider, string> = { groq: '', gemini: '', claude: '', tg_feedback_bot: '', tg_feedback_chat: '', tg_lisp_chat: '' };
      for (const docSnap of snap.docs) {
        const provider = docSnap.id as ApiKeyProvider;
        if (!ALL_PROVIDERS.includes(provider)) continue;
        try {
          const data = docSnap.data() as ApiKeyDoc;
          result[provider] = await decryptApiKey(data.encrypted);
        } catch (err) {
          console.error('[admin-keys] subscribe decrypt fail', provider, err);
        }
      }
      callback(result);
    },
    (err) => {
      console.error('[admin-keys] subscribe error', err);
    },
  );
}

/**
 * Load metadata (KHÔNG decrypt) cho UI hiển thị "ai sửa, lúc nào".
 */
export async function loadApiKeyMeta(
  tenant: string,
  provider: ApiKeyProvider,
): Promise<Pick<ApiKeyDoc, 'updatedAt' | 'modifiedBy' | 'modifiedByEmail'> | null> {
  try {
    const db = getFirebaseDb();
    const snap = await getDoc(doc(db, adminKeyPaths.apiKey(tenant, provider)));
    if (!snap.exists()) return null;
    const data = snap.data() as ApiKeyDoc;
    return {
      updatedAt: data.updatedAt,
      modifiedBy: data.modifiedBy,
      modifiedByEmail: data.modifiedByEmail,
    };
  } catch (err) {
    console.error('[admin-keys] loadApiKeyMeta fail', err);
    return null;
  }
}

// ============================================================
// Audit log
// ============================================================

/** Append audit log entry. Internal helper, gọi tự động bởi saveApiKey. */
async function logKeyChange(
  tenant: string,
  provider: ApiKeyProvider,
  action: 'set' | 'delete',
  modifiedBy: string,
  modifiedByEmail: string,
  note?: string,
): Promise<void> {
  try {
    const db = getFirebaseDb();
    await addDoc(collection(db, adminKeyPaths.auditLog(tenant)), {
      provider,
      action,
      modifiedBy,
      modifiedByEmail,
      timestamp: Date.now(),
      serverTime: serverTimestamp(),
      note: note ?? null,
    });
  } catch (err) {
    console.error('[admin-keys] logKeyChange fail', err);
  }
}

/**
 * Load audit log entries (mới nhất trước, cap 100 mặc định).
 */
export async function loadAuditLog(
  tenant: string,
  max: number = 100,
): Promise<AuditLogEntry[]> {
  try {
    const db = getFirebaseDb();
    const q = query(
      collection(db, adminKeyPaths.auditLog(tenant)),
      orderBy('timestamp', 'desc'),
      limit(max),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        provider: data.provider as ApiKeyProvider,
        action: data.action as 'set' | 'delete',
        modifiedBy: String(data.modifiedBy ?? ''),
        modifiedByEmail: String(data.modifiedByEmail ?? ''),
        timestamp: typeof data.timestamp === 'number' ? data.timestamp : 0,
        note: data.note ?? undefined,
      };
    });
  } catch (err) {
    console.error('[admin-keys] loadAuditLog fail', err);
    return [];
  }
}
