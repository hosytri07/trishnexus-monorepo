'use client';

/**
 * /ghi-chu — Phase 19.3 (Đợt 4A) — Notes web app.
 *
 * Web-side Firestore-backed multi-note tại path `/notes/{uid}/items/{noteId}`.
 * Path đồng bộ với rules có sẵn (Phase 11.7) + sẽ pickup được khi
 * TrishLibrary 3.0 desktop wire Firestore sync (hiện desktop dùng local file).
 *
 * MVP scope:
 *   - List notes (sort theo updated_at DESC)
 *   - Tạo note mới (title + body plain text)
 *   - Edit inline
 *   - Delete với confirm
 *   - Auto-save debounce 800ms
 *   - 2-pane layout: list bên trái 300px, editor bên phải fluid
 *
 * Không có (chuyển sang Phase tiếp): TipTap rich editor · backlinks ·
 * tags · daily note · templates · folders. Khi cần, port từ desktop module.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Loader2,
  Lock,
  NotebookPen,
  Plus,
  Save,
  Trash2,
} from 'lucide-react';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { db, firebaseReady } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';
import { useConfirm } from '@/components/confirm-modal';
import { TrialBlockedScreen } from '@/components/trial-blocked-screen';

interface NoteDoc {
  id: string;
  title: string;
  body: string;
  created_at: number;
  updated_at: number;
}

const SAVE_DEBOUNCE_MS = 800;

export default function GhiChuPage() {
  const { user, isAuthenticated, loading, isPaid } = useAuth();
  const [ConfirmDialog, askConfirm] = useConfirm();
  const [notes, setNotes] = useState<NoteDoc[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ title: string; body: string }>({
    title: '',
    body: '',
  });
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>(
    'idle',
  );
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const uid = user?.id;

  // Subscribe notes list
  useEffect(() => {
    if (!firebaseReady || !db || !uid) {
      setNotes([]);
      return;
    }
    const q = query(
      collection(db, `notes/${uid}/items`),
      orderBy('updated_at', 'desc'),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: NoteDoc[] = snap.docs
          .filter((d) => d.id !== 'quick-note') // tách quick-note widget riêng
          .map((d) => {
            const r = d.data();
            return {
              id: d.id,
              title: (r.title as string) ?? 'Untitled',
              body: (r.body as string) ?? '',
              created_at: (r.created_at as number) ?? 0,
              updated_at: (r.updated_at as number) ?? 0,
            };
          });
        setNotes(list);
      },
      (err) => {
        console.warn('[ghi-chu] subscribe fail', err);
        setNotes([]);
      },
    );
    return () => unsub();
  }, [uid]);

  // Sync activeId draft → bind state khi click note
  useEffect(() => {
    if (!notes || !activeId) return;
    const n = notes.find((x) => x.id === activeId);
    if (n) setDraft({ title: n.title, body: n.body });
  }, [activeId, notes]);

  // Debounced auto-save
  useEffect(() => {
    if (!firebaseReady || !db || !uid || !activeId) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      setSaveStatus('saving');
      try {
        await setDoc(
          doc(db!, `notes/${uid}/items/${activeId}`),
          {
            title: draft.title || 'Untitled',
            body: draft.body,
            updated_at: Date.now(),
            _server_updated_at: serverTimestamp(),
          },
          { merge: true },
        );
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 1500);
      } catch (err) {
        console.error('[ghi-chu] save fail', err);
        setSaveStatus('error');
      }
    }, SAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [draft.title, draft.body, activeId, uid]);

  async function createNote() {
    if (!firebaseReady || !db || !uid) return;
    const id = `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const now = Date.now();
    await setDoc(doc(db, `notes/${uid}/items/${id}`), {
      title: 'Ghi chú mới',
      body: '',
      created_at: now,
      updated_at: now,
      _server_created_at: serverTimestamp(),
    });
    setActiveId(id);
  }

  async function deleteNote(id: string) {
    if (!firebaseReady || !db || !uid) return;
    const __ok = await askConfirm({ title: 'Xác nhận', message: 'Xóa note này? Không thể khôi phục.', okLabel: 'Đồng ý' });
    if (!__ok) return;
    await deleteDoc(doc(db, `notes/${uid}/items/${id}`));
    if (activeId === id) {
      setActiveId(null);
      setDraft({ title: '', body: '' });
    }
  }

  // useMemo phải gọi trước conditional return để tuân thủ React Hooks rules
  const activeNote = useMemo(
    () => notes?.find((n) => n.id === activeId) ?? null,
    [notes, activeId],
  );

  if (loading) return <LoadingState />;
  if (!isAuthenticated) return <GuestState />;
  // Phase 19.16 — Block trial users
  if (!isPaid) return <TrialBlockedScreen featureName="Ghi chú" />;

  return (
    <main className="max-w-7xl mx-auto px-6 py-6">
      <ConfirmDialog />
      <Link
        href="/"
        className="inline-flex items-center gap-2 mb-4 text-sm transition-opacity hover:opacity-80"
        style={{ color: 'var(--color-text-muted)' }}
      >
        <ArrowLeft size={15} /> Quay lại Dashboard
      </Link>

      <header className="mb-4 flex items-center gap-3">
        <NotebookPen size={26} strokeWidth={1.75} style={{ color: 'var(--color-accent-primary)' }} />
        <h1 className="text-2xl md:text-3xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
          Ghi chú
        </h1>
        <span
          className="ml-1 inline-flex items-center px-2 h-5 rounded text-[10px] font-bold uppercase tracking-wide"
          style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent-primary)' }}
        >
          BETA
        </span>
      </header>

      {/* 2-pane layout */}
      <div
        className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-4 rounded-xl border overflow-hidden"
        style={{
          background: 'var(--color-surface-card)',
          borderColor: 'var(--color-border-default)',
          minHeight: 'calc(100vh - 200px)',
        }}
      >
        {/* LEFT — list */}
        <aside
          className="border-b md:border-b-0 md:border-r flex flex-col"
          style={{ borderColor: 'var(--color-border-subtle)' }}
        >
          <div
            className="p-3 border-b flex items-center justify-between gap-2"
            style={{ borderColor: 'var(--color-border-subtle)' }}
          >
            <span
              className="text-xs font-bold uppercase tracking-wider"
              style={{ color: 'var(--color-text-muted)' }}
            >
              {notes?.length ?? 0} note
            </span>
            <button
              type="button"
              onClick={createNote}
              className="inline-flex items-center gap-1 px-2 h-7 rounded text-xs font-semibold transition-opacity hover:opacity-90"
              style={{ background: 'var(--color-accent-gradient)', color: '#ffffff' }}
            >
              <Plus size={12} strokeWidth={2.5} />
              Mới
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {notes === null && (
              <div className="p-6 text-center text-xs" style={{ color: 'var(--color-text-muted)' }}>
                <Loader2 size={14} className="inline animate-spin mr-1" /> Đang tải…
              </div>
            )}
            {notes?.length === 0 && (
              <div className="p-6 text-center text-xs" style={{ color: 'var(--color-text-muted)' }}>
                Chưa có note nào.
                <br />
                Bấm <strong>+ Mới</strong> để bắt đầu.
              </div>
            )}
            {notes?.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => setActiveId(n.id)}
                className="w-full text-left px-3 py-2.5 transition-colors"
                style={{
                  background:
                    activeId === n.id ? 'var(--color-surface-muted)' : 'transparent',
                  borderLeft:
                    activeId === n.id
                      ? '3px solid var(--color-accent-primary)'
                      : '3px solid transparent',
                }}
              >
                <div
                  className="text-sm font-medium truncate"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  {n.title || 'Untitled'}
                </div>
                <div
                  className="text-xs truncate mt-0.5"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  {n.body.slice(0, 80) || '(trống)'}
                </div>
              </button>
            ))}
          </div>
        </aside>

        {/* RIGHT — editor */}
        <section className="flex flex-col">
          {!activeNote ? (
            <div
              className="flex-1 flex items-center justify-center p-10 text-center"
              style={{ color: 'var(--color-text-muted)' }}
            >
              <div>
                <NotebookPen size={36} strokeWidth={1.5} className="mx-auto mb-2" />
                <p className="text-sm">Chọn 1 note bên trái để xem hoặc bấm <strong>+ Mới</strong>.</p>
              </div>
            </div>
          ) : (
            <>
              <div
                className="px-4 py-2 border-b flex items-center gap-3"
                style={{ borderColor: 'var(--color-border-subtle)' }}
              >
                <input
                  type="text"
                  value={draft.title}
                  onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                  placeholder="Tiêu đề..."
                  className="flex-1 bg-transparent border-0 outline-none text-base font-semibold"
                  style={{ color: 'var(--color-text-primary)' }}
                />
                <SaveBadge status={saveStatus} />
                <button
                  type="button"
                  onClick={() => deleteNote(activeNote.id)}
                  className="inline-flex items-center justify-center w-7 h-7 rounded transition-colors hover:bg-[rgba(239,68,68,0.1)]"
                  title="Xóa note này"
                  style={{ color: '#EF4444' }}
                >
                  <Trash2 size={14} strokeWidth={2} />
                </button>
              </div>
              <textarea
                value={draft.body}
                onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
                placeholder="Bắt đầu viết..."
                className="flex-1 w-full p-4 bg-transparent border-0 outline-none resize-none text-sm leading-relaxed"
                style={{
                  color: 'var(--color-text-primary)',
                  fontFamily: 'var(--font-family-body)',
                  minHeight: 400,
                }}
              />
            </>
          )}
        </section>
      </div>

      <p className="mt-4 text-xs" style={{ color: 'var(--color-text-muted)' }}>
        Notes đồng bộ qua Firestore <code>/notes/{'{uid}'}/items/</code>.
        TrishLibrary 3.0 desktop sẽ pickup khi wire Firestore sync (hiện desktop dùng local file).
      </p>
    </main>
  );
}

function SaveBadge({ status }: { status: 'idle' | 'saving' | 'saved' | 'error' }) {
  if (status === 'idle') return null;
  const map = {
    saving: { label: 'Đang lưu...', color: 'var(--color-text-muted)' },
    saved: { label: '✓ Đã lưu', color: '#10B981' },
    error: { label: '⚠ Lỗi lưu', color: '#EF4444' },
  };
  const m = map[status as 'saving' | 'saved' | 'error'];
  return (
    <span
      className="inline-flex items-center gap-1 text-xs"
      style={{ color: m.color }}
    >
      {status === 'saving' && <Loader2 size={11} className="animate-spin" />}
      {status === 'saved' && <Save size={11} strokeWidth={2.25} />}
      {m.label}
    </span>
  );
}

function LoadingState() {
  return (
    <main className="max-w-5xl mx-auto px-6 py-16 text-center">
      <Loader2
        size={32}
        className="animate-spin mx-auto mb-3"
        style={{ color: 'var(--color-accent-primary)' }}
      />
      <p style={{ color: 'var(--color-text-muted)' }}>Đang kiểm tra đăng nhập...</p>
    </main>
  );
}

function GuestState() {
  return (
    <main className="max-w-md mx-auto px-6 py-16 text-center">
      <div
        className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-4"
        style={{ background: 'var(--color-surface-muted)' }}
      >
        <Lock size={26} strokeWidth={1.5} style={{ color: 'var(--color-text-muted)' }} />
      </div>
      <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--color-text-primary)' }}>
        Cần đăng nhập
      </h1>
      <p className="text-sm mb-5" style={{ color: 'var(--color-text-secondary)' }}>
        Notes lưu vào tài khoản của bạn. Đăng nhập để bắt đầu.
      </p>
      <Link
        href="/login?next=/ghi-chu"
        className="inline-flex items-center gap-2 px-5 h-10 rounded-md text-sm font-semibold transition-opacity hover:opacity-90"
        style={{ background: 'var(--color-accent-gradient)', color: '#ffffff' }}
      >
        Đăng nhập ngay
      </Link>
    </main>
  );
}
