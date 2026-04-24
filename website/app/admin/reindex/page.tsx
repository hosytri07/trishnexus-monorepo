'use client';

/**
 * /admin/reindex — Phase 12.5.
 *
 * Trang admin batch-index data tĩnh/dynamic vào Firestore `/semantic/*`:
 *   - Apps: 10 app từ registry (name + tagline + meta.features).
 *   - Announcements: tất cả announcement active.
 *   - (Notes: user reindex riêng từ dashboard, không làm ở đây.)
 *
 * Mỗi group có:
 *   - Last indexed count (đếm docs hiện có).
 *   - Nút "Reindex" → gọi batchUpsertSemanticDocs, progress bar.
 *   - Preview provider (Gemini/local) từ lần gọi /api/embed gần nhất.
 *
 * Yêu cầu env:
 *   - GOOGLE_AI_API_KEY (tuỳ chọn): bật Gemini text-embedding-004
 *     (768-dim). Không set → fallback hash 256-dim (demo only).
 */

import { useEffect, useState } from 'react';
import {
  Sparkles,
  Cpu,
  Megaphone,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import {
  collection,
  getDocs,
  query as fsQuery,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getAppsForWebsite } from '@/lib/apps';
import {
  batchUpsertSemanticDocs,
  fetchSemanticIndex,
  invalidateCache,
} from '@/lib/search';

interface GroupState {
  count: number;
  model: string | null;
  loading: boolean;
  running: boolean;
  progress: { done: number; total: number };
  error: string | null;
  lastRunAt: number | null;
}

const INITIAL: GroupState = {
  count: 0,
  model: null,
  loading: true,
  running: false,
  progress: { done: 0, total: 0 },
  error: null,
  lastRunAt: null,
};

export default function AdminReindexPage() {
  const [apps, setApps] = useState<GroupState>(INITIAL);
  const [ann, setAnn] = useState<GroupState>(INITIAL);

  // Load counts.
  const loadCounts = async () => {
    setApps((s) => ({ ...s, loading: true }));
    setAnn((s) => ({ ...s, loading: true }));
    try {
      const [a, b] = await Promise.all([
        fetchSemanticIndex('apps', { forceRefresh: true }),
        fetchSemanticIndex('announcements', { forceRefresh: true }),
      ]);
      setApps((s) => ({
        ...s,
        loading: false,
        count: a.length,
        model: a[0]?.model ?? null,
      }));
      setAnn((s) => ({
        ...s,
        loading: false,
        count: b.length,
        model: b[0]?.model ?? null,
      }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setApps((s) => ({ ...s, loading: false, error: msg }));
      setAnn((s) => ({ ...s, loading: false, error: msg }));
    }
  };

  useEffect(() => {
    loadCounts();
  }, []);

  const runReindexApps = async () => {
    setApps((s) => ({ ...s, running: true, error: null, progress: { done: 0, total: 0 } }));
    try {
      const items = getAppsForWebsite().map((app) => ({
        id: app.id,
        text: [app.name, app.tagline, ...(app.features ?? [])]
          .filter(Boolean)
          .join('. '),
        title: app.name,
        category: 'app' as const,
        href: `/apps#${app.id}`,
      }));
      await batchUpsertSemanticDocs('apps', items, (done, total) =>
        setApps((s) => ({ ...s, progress: { done, total } })),
      );
      setApps((s) => ({
        ...s,
        running: false,
        lastRunAt: Date.now(),
      }));
      invalidateCache('apps');
      loadCounts();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setApps((s) => ({ ...s, running: false, error: msg }));
    }
  };

  const runReindexAnnouncements = async () => {
    setAnn((s) => ({ ...s, running: true, error: null, progress: { done: 0, total: 0 } }));
    try {
      if (!db) throw new Error('firestore_not_configured');
      const q = fsQuery(
        collection(db, 'announcements'),
        where('active', '==', true),
      );
      const snap = await getDocs(q);
      const items: Parameters<typeof batchUpsertSemanticDocs>[1] = [];
      snap.forEach((d) => {
        const data = d.data() as {
          title?: string;
          message?: string;
          kind?: string;
        };
        if (!data.title && !data.message) return;
        items.push({
          id: d.id,
          text: [data.title ?? '', data.message ?? ''].join('. '),
          title: data.title ?? data.message?.slice(0, 60) ?? 'Thông báo',
          category: 'announcement' as const,
          href: '/',
        });
      });
      if (items.length === 0) {
        setAnn((s) => ({ ...s, running: false, error: 'Không có announcement active.' }));
        return;
      }
      await batchUpsertSemanticDocs('announcements', items, (done, total) =>
        setAnn((s) => ({ ...s, progress: { done, total } })),
      );
      setAnn((s) => ({ ...s, running: false, lastRunAt: Date.now() }));
      invalidateCache('announcements');
      loadCounts();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setAnn((s) => ({ ...s, running: false, error: msg }));
    }
  };

  return (
    <main
      className="max-w-4xl mx-auto px-6 py-8"
      style={{ color: 'var(--color-text-primary)' }}
    >
      <header className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Sparkles size={22} style={{ color: 'var(--color-accent-primary)' }} />
          <h1 className="text-2xl font-bold">Semantic Reindex</h1>
        </div>
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Tái tạo vector embedding cho universal search. Dùng Gemini
          text-embedding-004 nếu `GOOGLE_AI_API_KEY` được set, nếu không
          rơi vào fallback hash 256-dim (chỉ demo, không có semantic thật).
        </p>
      </header>

      <div className="flex flex-col gap-4">
        <ReindexCard
          title="Ứng dụng (apps)"
          subtitle="10 app ecosystem từ registry — index tên + tagline + features."
          icon={<Cpu size={18} />}
          state={apps}
          onRun={runReindexApps}
        />
        <ReindexCard
          title="Thông báo (announcements)"
          subtitle="Các announcement đang active — để user tìm ra khi search."
          icon={<Megaphone size={18} />}
          state={ann}
          onRun={runReindexAnnouncements}
        />
      </div>

      <div
        className="mt-8 rounded-lg px-4 py-3 text-sm"
        style={{
          background: 'var(--color-surface-card)',
          border: '1px solid var(--color-border-subtle)',
          color: 'var(--color-text-secondary)',
        }}
      >
        <strong>Ghi chú vận hành:</strong> index sẽ tự refresh cache trong
        5 phút tới. Đổi `GOOGLE_AI_API_KEY` phải reindex lại để vector
        cùng chiều. Notes của user reindex riêng (Phase 12.6 — khi user
        lưu QuickNote sẽ trigger embed riêng, không admin ở đây).
      </div>
    </main>
  );
}

function ReindexCard({
  title,
  subtitle,
  icon,
  state,
  onRun,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  state: GroupState;
  onRun: () => void;
}) {
  const pct =
    state.progress.total > 0
      ? Math.round((state.progress.done / state.progress.total) * 100)
      : 0;

  return (
    <section
      className="rounded-xl p-5"
      style={{
        background: 'var(--color-surface-card)',
        border: '1px solid var(--color-border-default)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div className="flex items-start gap-4">
        <div
          className="shrink-0 inline-flex items-center justify-center rounded-lg"
          style={{
            width: 40,
            height: 40,
            background: 'var(--color-accent-soft)',
            color: 'var(--color-accent-primary)',
          }}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold mb-1">{title}</h3>
          <p
            className="text-sm"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {subtitle}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-4 text-xs">
            <Stat
              label="Đã index"
              value={state.loading ? '...' : `${state.count} doc`}
            />
            <Stat label="Model" value={state.model ?? '—'} />
            {state.lastRunAt && (
              <Stat
                label="Chạy lần cuối"
                value={new Date(state.lastRunAt).toLocaleTimeString('vi-VN')}
              />
            )}
          </div>

          {state.running && (
            <div className="mt-3">
              <div
                className="h-2 rounded-full overflow-hidden"
                style={{ background: 'var(--color-surface-elevated)' }}
              >
                <div
                  className="h-full transition-all"
                  style={{
                    width: `${pct}%`,
                    background: 'var(--color-accent-primary)',
                  }}
                />
              </div>
              <div
                className="mt-1 text-[11px]"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {state.progress.done}/{state.progress.total} ({pct}%)
              </div>
            </div>
          )}

          {state.error && (
            <div
              className="mt-3 inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded"
              style={{
                background: 'rgba(239,68,68,0.12)',
                color: '#EF4444',
              }}
            >
              <AlertTriangle size={12} />
              {state.error}
            </div>
          )}
          {state.lastRunAt && !state.running && !state.error && (
            <div
              className="mt-3 inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded"
              style={{
                background: 'rgba(34,197,94,0.12)',
                color: '#16A34A',
              }}
            >
              <CheckCircle2 size={12} />
              Đã cập nhật xong.
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onRun}
          disabled={state.running}
          className="shrink-0 inline-flex items-center gap-1.5 px-4 h-9 rounded-md text-sm font-medium transition disabled:opacity-50"
          style={{
            background: 'var(--color-accent-gradient)',
            color: '#fff',
          }}
        >
          {state.running ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <RefreshCw size={14} />
          )}
          {state.running ? 'Đang chạy…' : 'Reindex'}
        </button>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        className="uppercase tracking-wider"
        style={{ color: 'var(--color-text-muted)', letterSpacing: '0.08em' }}
      >
        {label}
      </div>
      <div
        className="text-sm font-medium"
        style={{ color: 'var(--color-text-primary)' }}
      >
        {value}
      </div>
    </div>
  );
}
