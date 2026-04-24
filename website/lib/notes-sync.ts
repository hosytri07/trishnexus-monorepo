'use client';

/**
 * useNotesSync — Phase 11.7.1.
 *
 * Hook điều phối scratchpad "Ghi chú nhanh" giữa 2 nguồn lưu:
 *   - localStorage  (guest / Firebase chưa cấu hình)
 *   - Firestore     (đã login) tại /notes/{uid}/items/quick-note
 *
 * Flow:
 *   1. Mount → hydrate từ localStorage ngay (instant UX).
 *   2. Khi user login → subscribe Firestore doc `quick-note`:
 *      - Nếu doc chưa tồn tại và local có text → upload local lên remote.
 *      - Nếu remote có text → replace state bằng remote (multi-device).
 *   3. Người dùng gõ → state update → debounce 500ms → save tới target
 *      đang active (remote nếu auth, local nếu guest). Tiếp tục giữ bản
 *      local làm offline cache ngay cả khi đã login (phòng mất mạng).
 *   4. Logout → unsubscribe, quay về local-only.
 *
 * Trạng thái UI:
 *   - 'saved'  : đồng bộ xong (remote nếu auth, local nếu guest)
 *   - 'saving' : đang debounce / đang gọi setDoc
 *   - 'error'  : setDoc throw, rơi về local (text vẫn giữ)
 *   - 'local'  : chưa login, chỉ lưu localStorage
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import { useAuth } from './auth-context';
import { logActivity } from './activity-log';
import { upsertSemanticDoc, noteDocId } from './search';

const LOCAL_KEY = 'trishteam:quick-note';
const DEBOUNCE_MS = 500;
/** Phase 12.6: reindex semantic chậm hơn save để gộp nhiều keystroke. */
const SEMANTIC_DEBOUNCE_MS = 2000;
/** Không index note quá ngắn — không đáng tốn Gemini quota. */
const SEMANTIC_MIN_CHARS = 10;

export type NotesSyncStatus = 'saved' | 'saving' | 'error' | 'local';

export type NotesSyncSource = 'local' | 'remote';

export interface UseNotesSyncResult {
  text: string;
  setText: (v: string) => void;
  status: NotesSyncStatus;
  source: NotesSyncSource;
  clear: () => void;
  /** Thời điểm lần sync remote thành công gần nhất (ms epoch). */
  lastRemoteAt: number | null;
}

/**
 * Path Firestore của doc quick-note cho user.
 * Đặt dưới /notes/{uid}/items/{noteId} để khớp rules Phase 11.6.5.
 */
function quickNoteDocPath(uid: string) {
  return ['notes', uid, 'items', 'quick-note'] as const;
}

function readLocal(): string {
  try {
    return window.localStorage.getItem(LOCAL_KEY) ?? '';
  } catch {
    return '';
  }
}

function writeLocal(text: string) {
  try {
    if (text.length === 0) window.localStorage.removeItem(LOCAL_KEY);
    else window.localStorage.setItem(LOCAL_KEY, text);
  } catch {
    /* ignore quota / privacy mode */
  }
}

export function useNotesSync(): UseNotesSyncResult {
  const { user, mode, loading: authLoading } = useAuth();
  const authed = Boolean(user?.id) && mode === 'firebase';

  const [text, setTextState] = useState<string>('');
  const [status, setStatus] = useState<NotesSyncStatus>('saved');
  const [lastRemoteAt, setLastRemoteAt] = useState<number | null>(null);
  const source: NotesSyncSource = authed ? 'remote' : 'local';

  const saveTimer = useRef<number | null>(null);
  // Đánh dấu lần set text đến từ Firestore snapshot để tránh echo ngược
  // (snapshot → setTextState → effect save → ghi đè cùng text vô tri).
  const ignoreNextSaveRef = useRef<boolean>(false);
  // Track xem có pending local data cần push lên remote lần đầu không.
  const pendingLocalPushRef = useRef<string | null>(null);
  // Track uid đang subscribe để unsubscribe đúng lúc khi đổi user.
  const subscribedUidRef = useRef<string | null>(null);
  // Phase 12.6: semantic reindex debounce + cache last-indexed-text để skip no-op.
  const semanticTimer = useRef<number | null>(null);
  const lastIndexedTextRef = useRef<string>('');

  // ===== Hydrate local on mount =====
  useEffect(() => {
    const local = readLocal();
    if (local) {
      ignoreNextSaveRef.current = true;
      setTextState(local);
      pendingLocalPushRef.current = local;
    }
    // Trạng thái khởi đầu: local nếu chưa auth, saved nếu auth (sẽ override).
  }, []);

  // ===== Subscribe Firestore khi authed =====
  useEffect(() => {
    if (authLoading) return;
    if (!authed || !db || !user?.id) {
      // Đảm bảo unsubscribe nếu đổi từ authed → guest
      subscribedUidRef.current = null;
      setStatus('local');
      return;
    }
    if (subscribedUidRef.current === user.id) return;
    subscribedUidRef.current = user.id;

    const ref = doc(db, ...quickNoteDocPath(user.id));
    setStatus('saving');
    let unsub: Unsubscribe | null = null;
    try {
      unsub = onSnapshot(
        ref,
        async (snap) => {
          const data = snap.data() as
            | { text?: string; updatedAt?: { toMillis?: () => number } }
            | undefined;
          const remoteText = data?.text ?? '';
          if (!snap.exists() || (!remoteText && pendingLocalPushRef.current)) {
            // Remote trống + có pending local → push up lần đầu.
            const seed = pendingLocalPushRef.current ?? text;
            if (seed) {
              try {
                await setDoc(
                  ref,
                  {
                    text: seed,
                    updatedAt: serverTimestamp(),
                    createdAt: serverTimestamp(),
                  },
                  { merge: true },
                );
              } catch (err) {
                console.warn('[notes-sync] seed push fail', err);
              }
            }
            pendingLocalPushRef.current = null;
            return;
          }
          // Remote có dữ liệu → cập nhật UI nếu khác với state.
          pendingLocalPushRef.current = null;
          setLastRemoteAt(
            typeof data?.updatedAt?.toMillis === 'function'
              ? data!.updatedAt!.toMillis!()
              : Date.now(),
          );
          setTextState((prev) => {
            if (prev === remoteText) return prev;
            ignoreNextSaveRef.current = true;
            writeLocal(remoteText); // giữ local cache đồng bộ
            return remoteText;
          });
          setStatus('saved');
        },
        (err) => {
          console.error('[notes-sync] snapshot error', err);
          setStatus('error');
        },
      );
    } catch (err) {
      console.error('[notes-sync] subscribe fail', err);
      setStatus('error');
    }

    return () => {
      if (unsub) unsub();
      subscribedUidRef.current = null;
    };
  }, [authed, authLoading, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ===== Debounced save =====
  useEffect(() => {
    if (ignoreNextSaveRef.current) {
      ignoreNextSaveRef.current = false;
      return;
    }
    setStatus('saving');
    if (saveTimer.current) window.clearTimeout(saveTimer.current);

    const snapshot = text;
    saveTimer.current = window.setTimeout(async () => {
      // Luôn ghi local (làm offline cache).
      writeLocal(snapshot);
      if (!authed || !db || !user?.id) {
        setStatus('local');
        return;
      }
      try {
        const ref = doc(db, ...quickNoteDocPath(user.id));
        await setDoc(
          ref,
          {
            text: snapshot,
            updatedAt: serverTimestamp(),
            createdAt: serverTimestamp(),
          },
          { merge: true },
        );
        setLastRemoteAt(Date.now());
        setStatus('saved');
        // Log activity (throttled 1h) — ghi nhận user vừa cập nhật note.
        void logActivity(user.id, {
          kind: 'note_update',
          title: 'Cập nhật ghi chú nhanh',
          meta: { chars: snapshot.length },
        });
        // Phase 12.6: schedule semantic reindex (debounced, skip-if-same).
        scheduleSemanticReindex(user.id, snapshot);
      } catch (err) {
        console.error('[notes-sync] remote save fail', err);
        setStatus('error');
      }
    }, DEBOUNCE_MS);

    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [text, authed, user?.id]);

  // Phase 12.6: debounced semantic reindex helper.
  // Gọi sau khi save remote thành công. Guard:
  //   - skip nếu text < SEMANTIC_MIN_CHARS (không đáng index).
  //   - skip nếu text giống lần index trước (no-op).
  //   - debounce SEMANTIC_DEBOUNCE_MS để gộp burst keystroke.
  const scheduleSemanticReindex = useCallback(
    (uid: string, noteText: string) => {
      if (semanticTimer.current) window.clearTimeout(semanticTimer.current);
      const clean = noteText.trim();
      if (clean.length < SEMANTIC_MIN_CHARS) return;
      if (clean === lastIndexedTextRef.current) return;
      semanticTimer.current = window.setTimeout(async () => {
        try {
          const title =
            clean.split('\n')[0].slice(0, 80) || 'Ghi chú nhanh';
          await upsertSemanticDoc({
            kind: 'notes',
            id: noteDocId(uid, 'quick-note'),
            text: clean,
            title,
            category: 'note',
            href: '/#notes',
          });
          lastIndexedTextRef.current = clean;
        } catch (e) {
          console.warn('[notes-sync] semantic reindex fail', e);
        }
      }, SEMANTIC_DEBOUNCE_MS);
    },
    [],
  );

  // Cleanup semantic timer khi unmount / đổi user.
  useEffect(() => {
    return () => {
      if (semanticTimer.current) {
        window.clearTimeout(semanticTimer.current);
        semanticTimer.current = null;
      }
    };
  }, [user?.id]);

  // ===== Status mặc định khi guest =====
  useEffect(() => {
    if (!authed && status === 'saving' && !saveTimer.current) {
      setStatus('local');
    }
  }, [authed, status]);

  const setText = useCallback((v: string) => {
    setTextState(v);
  }, []);

  const clear = useCallback(() => {
    ignoreNextSaveRef.current = false;
    setTextState('');
  }, []);

  return {
    text,
    setText,
    status,
    source,
    clear,
    lastRemoteAt,
  };
}
