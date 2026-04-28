'use client';

/**
 * /tai-lieu — Phase 19.14 — Document editor markdown.
 *
 * Web-side Firestore-backed document editor:
 *   - List documents trái 280px
 *   - Editor phải: markdown source / preview / split view
 *   - Auto-save debounce 800ms
 *   - 6 templates VN cho quick-start (báo cáo, biên bản, hợp đồng, ...)
 *   - Path Firestore: /documents/{uid}/items/{docId}
 *
 * Khi TrishLibrary 3.0 desktop wire Firestore sync → đọc cùng path,
 * sync 2 chiều miễn phí.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Eye,
  FileText,
  Loader2,
  Lock,
  Plus,
  Save,
  SplitSquareHorizontal,
  Sparkles,
  Trash2,
  Pencil,
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
import { marked } from 'marked';
import { db, firebaseReady } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';
import { useConfirm } from '@/components/confirm-modal';
import { TrialBlockedScreen } from '@/components/trial-blocked-screen';

interface DocumentItem {
  id: string;
  title: string;
  body: string;
  template?: string;
  created_at: number;
  updated_at: number;
}

type ViewMode = 'edit' | 'preview' | 'split';

const SAVE_DEBOUNCE_MS = 800;

const TEMPLATES: { id: string; name: string; description: string; body: string }[] = [
  {
    id: 'bao-cao',
    name: 'Báo cáo',
    description: 'Mẫu báo cáo công việc tuần / tháng',
    body: `# Báo cáo công việc

**Người báo cáo**: [Họ tên]
**Phòng ban**: [Phòng]
**Kỳ báo cáo**: [Tuần X / Tháng Y]
**Ngày**: [DD/MM/YYYY]

## 1. Công việc đã hoàn thành

- Hạng mục 1
- Hạng mục 2

## 2. Công việc đang thực hiện

- Việc A — tiến độ X%
- Việc B — chờ phản hồi

## 3. Khó khăn / Vướng mắc

(Mô tả nếu có)

## 4. Kế hoạch tuần tới

- Mục tiêu 1
- Mục tiêu 2

---
**Ký tên**:
`,
  },
  {
    id: 'bien-ban',
    name: 'Biên bản họp',
    description: 'Biên bản cuộc họp với agenda + action items',
    body: `# BIÊN BẢN HỌP

**Tên cuộc họp**: [Tên]
**Ngày**: [DD/MM/YYYY] · **Giờ**: [HH:MM] · **Địa điểm**: [Phòng / Online]
**Chủ trì**: [Họ tên]
**Thư ký**: [Họ tên]

## Thành phần tham dự

1. [Họ tên — Chức vụ]
2. [Họ tên — Chức vụ]

## Nội dung họp

### 1. [Chủ đề 1]

- Trình bày
- Thảo luận
- Kết luận

### 2. [Chủ đề 2]

- Trình bày
- Thảo luận
- Kết luận

## Quyết định

| # | Nội dung | Người phụ trách | Hạn |
|---|---|---|---|
| 1 | ... | ... | ... |

## Kết luận

(Tóm tắt kết quả họp, các bên đồng thuận điểm gì)

---
**Người chủ trì**: ____________  **Thư ký**: ____________
`,
  },
  {
    id: 'hop-dong',
    name: 'Hợp đồng nguyên tắc',
    description: 'Khung hợp đồng nguyên tắc đơn giản',
    body: `# HỢP ĐỒNG NGUYÊN TẮC

**Số**: [Số HĐ] / [Năm]
**Ngày**: [DD/MM/YYYY]

## Bên A

- Tên: [Tên công ty / cá nhân]
- Đại diện: [Họ tên — Chức vụ]
- Địa chỉ: [Địa chỉ]
- MST: [Mã số thuế]

## Bên B

- Tên: ...
- Đại diện: ...
- Địa chỉ: ...
- MST: ...

## Điều 1: Nội dung hợp đồng

(Mô tả công việc, sản phẩm, dịch vụ)

## Điều 2: Giá trị + Phương thức thanh toán

- Tổng giá trị: [Số tiền]
- Thanh toán: [Tỷ lệ + thời điểm]

## Điều 3: Thời gian thực hiện

- Bắt đầu: [Ngày]
- Hoàn thành: [Ngày]

## Điều 4: Quyền và nghĩa vụ

(Của bên A và bên B)

## Điều 5: Điều khoản chung

- Hợp đồng có hiệu lực kể từ ngày ký
- Mọi tranh chấp giải quyết theo pháp luật Việt Nam

---
**ĐẠI DIỆN BÊN A**          **ĐẠI DIỆN BÊN B**
(Ký + đóng dấu)              (Ký + đóng dấu)
`,
  },
  {
    id: 'thuyet-minh',
    name: 'Thuyết minh kỹ thuật',
    description: 'Khung thuyết minh thiết kế / dự án',
    body: `# THUYẾT MINH KỸ THUẬT

## Phần I — Thông tin chung

### 1. Tên dự án
[Tên đầy đủ]

### 2. Chủ đầu tư
[Tên + địa chỉ]

### 3. Đơn vị thiết kế
[Tên + địa chỉ + chứng chỉ]

### 4. Địa điểm xây dựng
[Tỉnh / Huyện / Xã / Đường]

### 5. Quy mô / Cấp công trình
[Phân loại theo Nghị định 06/2021]

## Phần II — Cơ sở pháp lý

- Quyết định phê duyệt chủ trương đầu tư số ...
- QCVN, TCVN áp dụng:
  - QCVN 41:2024 — Báo hiệu đường bộ
  - TCVN 4054:2005 — Đường ô tô
  - ...

## Phần III — Giải pháp kỹ thuật

### 1. Bình đồ tuyến
(Mô tả + hình)

### 2. Trắc dọc
(Mô tả độ dốc, cao độ)

### 3. Trắc ngang
(Mô tả mặt cắt điển hình)

### 4. Kết cấu mặt đường
(BTN, BTXM, ...)

### 5. Hệ thống thoát nước
(Cống dọc, cống ngang)

### 6. An toàn giao thông
(Biển báo, vạch sơn, đèn tín hiệu)

## Phần IV — Khái toán

| TT | Hạng mục | Đơn vị | Khối lượng | Đơn giá | Thành tiền |
|---|---|---|---|---|---|
| 1 | ... | ... | ... | ... | ... |

## Phần V — Kết luận và kiến nghị

(Tóm tắt + ý kiến đề xuất)
`,
  },
  {
    id: 'de-xuat',
    name: 'Đề xuất',
    description: 'Đề xuất ý tưởng / dự án',
    body: `# ĐỀ XUẤT

**Người đề xuất**: [Họ tên]
**Ngày**: [DD/MM/YYYY]
**Gửi**: [Người nhận]

## 1. Bối cảnh

(Vấn đề hiện tại, tại sao cần giải quyết)

## 2. Mục tiêu

- Mục tiêu chính
- Mục tiêu phụ

## 3. Giải pháp đề xuất

### Phương án A
- Mô tả
- Ưu điểm
- Nhược điểm

### Phương án B
- Mô tả
- Ưu điểm
- Nhược điểm

**Phương án khuyến nghị**: [A / B]

## 4. Kế hoạch triển khai

| Giai đoạn | Mốc thời gian | Người phụ trách |
|---|---|---|
| 1. | ... | ... |
| 2. | ... | ... |

## 5. Ngân sách

- Tổng cộng: [Số tiền]
- Phân bổ: [Chi tiết]

## 6. Rủi ro + Mitigation

- Rủi ro 1: [Mô tả] → Cách giảm: [...]
- Rủi ro 2: ...

## 7. Kết luận

(Đề nghị phê duyệt / phản hồi trước [ngày])
`,
  },
  {
    id: 'ghi-chu-trong',
    name: 'Tài liệu trống',
    description: 'Bắt đầu từ trang trắng',
    body: '# Tiêu đề\n\nNội dung...\n',
  },
];

export default function TaiLieuPage() {
  const { user, isAuthenticated, loading, isPaid } = useAuth();
  const [docs, setDocs] = useState<DocumentItem[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ title: string; body: string }>({ title: '', body: '' });
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [showTemplates, setShowTemplates] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const uid = user?.id;

  // Subscribe documents
  useEffect(() => {
    if (!firebaseReady || !db || !uid) {
      setDocs([]);
      return;
    }
    const q = query(
      collection(db, `documents/${uid}/items`),
      orderBy('updated_at', 'desc'),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: DocumentItem[] = snap.docs.map((d) => {
          const r = d.data();
          return {
            id: d.id,
            title: (r.title as string) ?? 'Untitled',
            body: (r.body as string) ?? '',
            template: (r.template as string) ?? undefined,
            created_at: (r.created_at as number) ?? 0,
            updated_at: (r.updated_at as number) ?? 0,
          };
        });
        setDocs(list);
      },
      (err) => {
        console.warn('[tai-lieu] subscribe fail', err);
        setDocs([]);
      },
    );
    return () => unsub();
  }, [uid]);

  // Sync activeId draft
  useEffect(() => {
    if (!docs || !activeId) return;
    const d = docs.find((x) => x.id === activeId);
    if (d) setDraft({ title: d.title, body: d.body });
  }, [activeId, docs]);

  // Auto-save debounce
  useEffect(() => {
    if (!firebaseReady || !db || !uid || !activeId) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      setSaveStatus('saving');
      try {
        await setDoc(
          doc(db!, `documents/${uid}/items/${activeId}`),
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
        console.error('[tai-lieu] save fail', err);
        setSaveStatus('error');
      }
    }, SAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [draft.title, draft.body, activeId, uid]);

  async function createDoc(template?: typeof TEMPLATES[number]) {
    if (!firebaseReady || !db || !uid) return;
    const id = `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const now = Date.now();
    await setDoc(doc(db, `documents/${uid}/items/${id}`), {
      title: template?.name ?? 'Tài liệu mới',
      body: template?.body ?? '# Tiêu đề\n\nNội dung...\n',
      template: template?.id,
      created_at: now,
      updated_at: now,
      _server_created_at: serverTimestamp(),
    });
    setActiveId(id);
    setShowTemplates(false);
  }

  async function deleteDocItem(id: string) {
    if (!firebaseReady || !db || !uid) return;
    const __ok = await askConfirm({ title: 'Xác nhận', message: 'Xoá tài liệu này? Không thể khôi phục.', okLabel: 'Đồng ý' });
    if (!__ok) return;
    await deleteDoc(doc(db, `documents/${uid}/items/${id}`));
    if (activeId === id) {
      setActiveId(null);
      setDraft({ title: '', body: '' });
    }
  }

  const activeDoc = useMemo(
    () => docs?.find((d) => d.id === activeId) ?? null,
    [docs, activeId],
  );

  const renderedHtml = useMemo(() => {
    try {
      const result = marked.parse(draft.body, { async: false });
      return typeof result === 'string' ? result : '';
    } catch (err) {
      console.warn('[marked] parse fail', err);
      return '';
    }
  }, [draft.body]);

  if (loading) return <LoadingState />;
  if (!isAuthenticated) return <GuestState />;
  // Phase 19.16 — Block trial users
  if (!isPaid) return <TrialBlockedScreen featureName="Tài liệu" />;

  return (
    <main className="max-w-7xl mx-auto px-4 lg:px-6 py-4">
      <ConfirmDialog />
      <Link
        href="/"
        className="inline-flex items-center gap-2 mb-3 text-sm transition-opacity hover:opacity-80"
        style={{ color: 'var(--color-text-muted)' }}
      >
        <ArrowLeft size={15} /> Quay lại Dashboard
      </Link>

      <header className="mb-3 flex items-center gap-3">
        <FileText size={26} strokeWidth={1.75} style={{ color: 'var(--color-accent-primary)' }} />
        <h1 className="text-2xl md:text-3xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
          Tài liệu
        </h1>
        <span
          className="ml-1 inline-flex items-center px-2 h-5 rounded text-[10px] font-bold uppercase tracking-wide"
          style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent-primary)' }}
        >
          MARKDOWN BETA
        </span>
      </header>

      {/* 2-pane */}
      <div
        className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-3 rounded-xl border overflow-hidden"
        style={{
          background: 'var(--color-surface-card)',
          borderColor: 'var(--color-border-default)',
          minHeight: 'calc(100vh - 180px)',
        }}
      >
        {/* LEFT — list */}
        <aside
          className="border-b lg:border-b-0 lg:border-r flex flex-col"
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
              {docs?.length ?? 0} tài liệu
            </span>
            <button
              type="button"
              onClick={() => setShowTemplates((s) => !s)}
              className="inline-flex items-center gap-1 px-2 h-7 rounded text-xs font-semibold transition-opacity hover:opacity-90"
              style={{ background: 'var(--color-accent-gradient)', color: '#ffffff' }}
            >
              <Plus size={12} strokeWidth={2.5} />
              Mới
            </button>
          </div>

          {showTemplates && (
            <div
              className="p-2 border-b max-h-72 overflow-y-auto"
              style={{ borderColor: 'var(--color-border-subtle)', background: 'var(--color-surface-bg_elevated)' }}
            >
              <p className="text-[10px] uppercase font-bold tracking-wider mb-1.5 px-1.5" style={{ color: 'var(--color-text-muted)' }}>
                Chọn template
              </p>
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => createDoc(t)}
                  className="w-full text-left p-2 rounded transition-colors hover:bg-[var(--color-surface-muted)]"
                >
                  <div
                    className="text-xs font-semibold"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    {t.name}
                  </div>
                  <div className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                    {t.description}
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            {docs === null && (
              <div className="p-6 text-center text-xs" style={{ color: 'var(--color-text-muted)' }}>
                <Loader2 size={14} className="inline animate-spin mr-1" /> Đang tải…
              </div>
            )}
            {docs?.length === 0 && (
              <div className="p-6 text-center text-xs" style={{ color: 'var(--color-text-muted)' }}>
                Chưa có tài liệu nào.
                <br />
                Bấm <strong>+ Mới</strong> để bắt đầu.
              </div>
            )}
            {docs?.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setActiveId(d.id)}
                className="w-full text-left px-3 py-2.5 transition-colors group flex items-start gap-2"
                style={{
                  background: activeId === d.id ? 'var(--color-surface-muted)' : 'transparent',
                  borderLeft:
                    activeId === d.id
                      ? '3px solid var(--color-accent-primary)'
                      : '3px solid transparent',
                }}
              >
                <FileText
                  size={14}
                  strokeWidth={1.75}
                  className="shrink-0 mt-0.5"
                  style={{ color: 'var(--color-text-muted)' }}
                />
                <div className="flex-1 min-w-0">
                  <div
                    className="text-sm font-medium truncate"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    {d.title || 'Untitled'}
                  </div>
                  <div
                    className="text-xs truncate mt-0.5"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    {d.body.slice(0, 60).replace(/\n/g, ' ') || '(trống)'}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </aside>

        {/* RIGHT — editor */}
        <section className="flex flex-col">
          {!activeDoc ? (
            <div
              className="flex-1 flex items-center justify-center p-10 text-center"
              style={{ color: 'var(--color-text-muted)' }}
            >
              <div>
                <FileText size={36} strokeWidth={1.5} className="mx-auto mb-2" />
                <p className="text-sm">
                  Chọn 1 tài liệu bên trái để xem hoặc bấm <strong>+ Mới</strong>.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Top bar */}
              <div
                className="px-4 py-2 border-b flex items-center gap-3 flex-wrap"
                style={{ borderColor: 'var(--color-border-subtle)' }}
              >
                <input
                  type="text"
                  value={draft.title}
                  onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                  placeholder="Tiêu đề..."
                  className="flex-1 min-w-[200px] bg-transparent border-0 outline-none text-base font-semibold"
                  style={{ color: 'var(--color-text-primary)' }}
                />
                <SaveBadge status={saveStatus} />
                <ViewModeSwitch mode={viewMode} onChange={setViewMode} />
                <button
                  type="button"
                  onClick={() => deleteDocItem(activeDoc.id)}
                  className="inline-flex items-center justify-center w-7 h-7 rounded transition-colors hover:bg-[rgba(239,68,68,0.1)]"
                  title="Xoá"
                  style={{ color: '#EF4444' }}
                >
                  <Trash2 size={14} strokeWidth={2} />
                </button>
              </div>

              {/* Editor + Preview */}
              <div className={viewMode === 'split' ? 'grid lg:grid-cols-2 flex-1' : 'flex-1 flex flex-col'}>
                {(viewMode === 'edit' || viewMode === 'split') && (
                  <textarea
                    value={draft.body}
                    onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
                    placeholder="Viết markdown..."
                    spellCheck={false}
                    className="w-full p-4 bg-transparent border-0 outline-none resize-none text-sm leading-relaxed font-mono flex-1"
                    style={{
                      color: 'var(--color-text-primary)',
                      borderRight:
                        viewMode === 'split'
                          ? '1px solid var(--color-border-subtle)'
                          : 'none',
                      minHeight: 400,
                    }}
                  />
                )}
                {(viewMode === 'preview' || viewMode === 'split') && (
                  <div
                    className="p-4 overflow-y-auto blog-prose flex-1"
                    style={{ minHeight: 400 }}
                    dangerouslySetInnerHTML={{ __html: renderedHtml }}
                  />
                )}
              </div>
            </>
          )}
        </section>
      </div>

      <p className="mt-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>
        Tài liệu lưu Firestore <code>/documents/{'{uid}'}/items/</code>. TrishLibrary 3.0
        desktop sẽ pickup khi wire Firestore sync.
      </p>
    </main>
  );
}

function ViewModeSwitch({ mode, onChange }: { mode: ViewMode; onChange: (m: ViewMode) => void }) {
  const opts: { id: ViewMode; icon: React.ReactNode; label: string }[] = [
    { id: 'edit', icon: <Pencil size={11} />, label: 'Sửa' },
    { id: 'split', icon: <SplitSquareHorizontal size={11} />, label: 'Cả 2' },
    { id: 'preview', icon: <Eye size={11} />, label: 'Xem' },
  ];
  return (
    <div
      className="inline-flex p-0.5 rounded"
      style={{ background: 'var(--color-surface-bg_elevated)' }}
    >
      {opts.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className="inline-flex items-center gap-1 px-2 h-7 rounded text-[11px] font-semibold transition-colors"
          style={{
            background: mode === o.id ? 'var(--color-accent-soft)' : 'transparent',
            color: mode === o.id ? 'var(--color-accent-primary)' : 'var(--color-text-muted)',
          }}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

function SaveBadge({ status }: { status: 'idle' | 'saving' | 'saved' | 'error' }) {
  if (status === 'idle') return null;
  const map = {
    saving: { label: 'Đang lưu…', color: 'var(--color-text-muted)' },
    saved: { label: '✓ Đã lưu', color: '#10B981' },
    error: { label: '⚠ Lỗi lưu', color: '#EF4444' },
  };
  const m = map[status];
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
      <Loader2 size={32} className="animate-spin mx-auto mb-3" style={{ color: 'var(--color-accent-primary)' }} />
      <p style={{ color: 'var(--color-text-muted)' }}>Đang kiểm tra đăng nhập…</p>
    </main>
  );
}

function GuestState() {
  return (
    <main className="max-w-md mx-auto px-6 py-16 text-center">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-4" style={{ background: 'var(--color-surface-muted)' }}>
        <Lock size={26} strokeWidth={1.5} style={{ color: 'var(--color-text-muted)' }} />
      </div>
      <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--color-text-primary)' }}>
        Cần đăng nhập
      </h1>
      <p className="text-sm mb-5" style={{ color: 'var(--color-text-secondary)' }}>
        Tài liệu lưu vào tài khoản của bạn để truy cập đa thiết bị.
      </p>
      <Link
        href="/login?next=/tai-lieu"
        className="inline-flex items-center gap-2 px-5 h-10 rounded-md text-sm font-semibold transition-opacity hover:opacity-90"
        style={{ background: 'var(--color-accent-gradient)', color: '#ffffff' }}
      >
        <Sparkles size={14} /> Đăng nhập ngay
      </Link>
    </main>
  );
}
