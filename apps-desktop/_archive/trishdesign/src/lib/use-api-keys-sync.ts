/**
 * useApiKeysSync — TrishDesign side của Phase 28.8.
 *
 * Subscribe Firestore /admin_settings/{tenant}/api_keys/* → mirror vào
 * localStorage (key cũ): trishdesign:groq-api-key, trishdesign:claude-api-key.
 *
 * Logic:
 *   1. Cần signed-in user (paid hoặc admin).
 *   2. Resolve tenant ID từ profile + localStorage.
 *   3. onSnapshot — mỗi lần admin sửa key bên TrishAdmin, trong vài giây
 *      TrishDesign sẽ nhận update + rewrite localStorage.
 *   4. Cleanup unsubscribe khi user đăng xuất / unmount.
 *
 * Backward compat: nếu Firestore không có key, KHÔNG xoá key local. Cho phép
 * admin set key offline qua Settings → Admin section như cũ. Khi Firestore
 * lại có key, sync ghi đè.
 */

import { useEffect } from 'react';
import { useAuth } from '@trishteam/auth/react';
import { subscribeApiKeys, resolveTenantId } from '@trishteam/admin-keys';

const GROQ_KEY = 'trishdesign:groq-api-key';
const GEMINI_KEY = 'trishdesign:gemini-api-key';
const CLAUDE_KEY = 'trishdesign:claude-api-key';
const TG_BOT_KEY = 'trishdesign:tg-feedback-bot-token';
const TG_CHAT_KEY = 'trishdesign:tg-feedback-chat-id';
const TG_LISP_CHAT_KEY = 'trishdesign:tg-lisp-chat-id';
const SYNC_META_KEY = 'trishdesign:apikey-sync-meta';

interface SyncMeta {
  /** ms timestamp lần sync gần nhất */
  lastSyncAt: number;
  /** Tenant đang sync */
  tenant: string;
  /** Provider có Firestore push xuống (để biết key local là từ Firestore hay manual) */
  fromFirestore: { groq: boolean; gemini: boolean; claude: boolean; tg_bot: boolean; tg_chat: boolean };
}

export function useApiKeysSync(): void {
  const { firebaseUser, profile } = useAuth();

  useEffect(() => {
    if (!firebaseUser) return;
    const tenant = resolveTenantId(profile);
    let cancelled = false;

    const unsub = subscribeApiKeys(tenant, (keys) => {
      if (cancelled) return;
      try {
        const fromFs = { groq: false, gemini: false, claude: false, tg_bot: false, tg_chat: false };
        if (keys.groq) {
          window.localStorage.setItem(GROQ_KEY, keys.groq);
          fromFs.groq = true;
        }
        if (keys.gemini) {
          window.localStorage.setItem(GEMINI_KEY, keys.gemini);
          fromFs.gemini = true;
        }
        if (keys.claude) {
          window.localStorage.setItem(CLAUDE_KEY, keys.claude);
          fromFs.claude = true;
        }
        if (keys.tg_feedback_bot) {
          window.localStorage.setItem(TG_BOT_KEY, keys.tg_feedback_bot);
          fromFs.tg_bot = true;
        }
        if (keys.tg_feedback_chat) {
          window.localStorage.setItem(TG_CHAT_KEY, keys.tg_feedback_chat);
          fromFs.tg_chat = true;
        }
        if (keys.tg_lisp_chat) {
          window.localStorage.setItem(TG_LISP_CHAT_KEY, keys.tg_lisp_chat);
        }
        const meta: SyncMeta = {
          lastSyncAt: Date.now(),
          tenant,
          fromFirestore: fromFs,
        };
        window.localStorage.setItem(SYNC_META_KEY, JSON.stringify(meta));
        // Phát event cho SettingsPanel cập nhật badge "synced"
        window.dispatchEvent(new CustomEvent('trishdesign:apikey-synced', { detail: meta }));
      } catch (err) {
        console.error('[trishdesign] api-keys sync write fail', err);
      }
    });

    return () => {
      cancelled = true;
      try {
        unsub();
      } catch {
        /* ignore */
      }
    };
  }, [firebaseUser, profile]);
}

/** SettingsPanel call để hiển thị "đã sync lúc nào, từ tenant nào". */
export function readSyncMeta(): SyncMeta | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(SYNC_META_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SyncMeta;
  } catch {
    return null;
  }
}
