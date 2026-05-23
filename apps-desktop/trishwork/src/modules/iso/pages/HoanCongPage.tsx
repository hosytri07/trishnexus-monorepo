/**
 * Phase 38.4 — Hoan Cong Checklist.
 *
 * Checklist hồ sơ hoàn công theo loại công trình. Admin/User tick từng item
 * "Đủ / Thiếu / Đang chuẩn bị" → hiện % hoàn thành.
 *
 * Persist localStorage: 'trishiso:hoancong:v1' = { [projectId]: HoanCongState }
 *
 * 4 preset loại công trình:
 *   - Đường (Road) — 14 items
 *   - Cầu (Bridge) — 12 items
 *   - Thoát nước (Drainage) — 9 items
 *   - Điện (Electrical) — 10 items
 *
 * Có thể thêm preset / item custom sau qua admin panel.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Circle,
  Clock,
  ClipboardCheck,
  Plus,
  Trash2,
  XCircle,
} from 'lucide-react';

export type HoanCongCategory = 'road' | 'bridge' | 'drainage' | 'electrical';

export type HoanCongStatus = 'done' | 'preparing' | 'missing';

interface HoanCongItem {
  id: string;
  label: string;
  required: boolean;
}

interface HoanCongPreset {
  category: HoanCongCategory;
  label: string;
  icon: string;
  groups: { groupLabel: string; items: HoanCongItem[] }[];
}

interface ItemState {
  status: HoanCongStatus;
  note?: string;
  attachmentCount?: number;
}

interface HoanCongState {
  category: HoanCongCategory;
  projectName: string;
  itemStates: Record<string, ItemState>;
  updatedAt: number;
}

const LS_KEY = 'trishiso:hoancong:v1';

// ============================================================
// Presets — 4 loại công trình theo TCVN/TCN
// ============================================================
const PRESETS: HoanCongPreset[] = [
  {
    category: 'road',
    label: 'Đường ô tô',
    icon: '🛣',
    groups: [
      {
        groupLabel: 'Pháp lý',
        items: [
          { id: 'r-leg-1', label: 'Quyết định phê duyệt dự án', required: true },
          { id: 'r-leg-2', label: 'Hợp đồng thi công', required: true },
          { id: 'r-leg-3', label: 'Giấy phép thi công', required: true },
        ],
      },
      {
        groupLabel: 'Bản vẽ',
        items: [
          { id: 'r-dwg-1', label: 'Bản vẽ thiết kế thi công', required: true },
          { id: 'r-dwg-2', label: 'Bản vẽ hoàn công mặt đường', required: true },
          { id: 'r-dwg-3', label: 'Bản vẽ hoàn công cống ngang', required: false },
          { id: 'r-dwg-4', label: 'Bản vẽ hoàn công mặt cắt ngang', required: true },
        ],
      },
      {
        groupLabel: 'Chất lượng',
        items: [
          { id: 'r-qc-1', label: 'Biên bản nghiệm thu vật liệu đầu vào', required: true },
          { id: 'r-qc-2', label: 'Kết quả thí nghiệm CBR / Marshall', required: true },
          { id: 'r-qc-3', label: 'Biên bản nghiệm thu công tác đào đắp', required: true },
          { id: 'r-qc-4', label: 'Biên bản nghiệm thu lớp móng', required: true },
          { id: 'r-qc-5', label: 'Biên bản nghiệm thu lớp mặt', required: true },
          { id: 'r-qc-6', label: 'Nhật ký thi công', required: true },
          { id: 'r-qc-7', label: 'Ảnh hiện trường (đủ 3 giai đoạn: trước/giữa/sau)', required: true },
        ],
      },
    ],
  },
  {
    category: 'bridge',
    label: 'Cầu',
    icon: '🌉',
    groups: [
      {
        groupLabel: 'Pháp lý',
        items: [
          { id: 'b-leg-1', label: 'Quyết định phê duyệt dự án', required: true },
          { id: 'b-leg-2', label: 'Hợp đồng + phụ lục', required: true },
        ],
      },
      {
        groupLabel: 'Bản vẽ',
        items: [
          { id: 'b-dwg-1', label: 'Bản vẽ kết cấu mố trụ', required: true },
          { id: 'b-dwg-2', label: 'Bản vẽ hoàn công dầm/bản mặt cầu', required: true },
          { id: 'b-dwg-3', label: 'Bản vẽ thoát nước cầu', required: true },
        ],
      },
      {
        groupLabel: 'Chất lượng',
        items: [
          { id: 'b-qc-1', label: 'Kết quả thí nghiệm bê tông (mác + cường độ)', required: true },
          { id: 'b-qc-2', label: 'Kết quả thí nghiệm thép (kéo + uốn)', required: true },
          { id: 'b-qc-3', label: 'Biên bản nghiệm thu cọc khoan nhồi', required: false },
          { id: 'b-qc-4', label: 'Biên bản nghiệm thu lắp dầm', required: true },
          { id: 'b-qc-5', label: 'Biên bản nghiệm thu bản mặt cầu', required: true },
          { id: 'b-qc-6', label: 'Thử tải tĩnh / động (nếu có)', required: false },
          { id: 'b-qc-7', label: 'Ảnh hiện trường đủ giai đoạn', required: true },
        ],
      },
    ],
  },
  {
    category: 'drainage',
    label: 'Thoát nước',
    icon: '🚰',
    groups: [
      {
        groupLabel: 'Bản vẽ',
        items: [
          { id: 'd-dwg-1', label: 'Bản vẽ hoàn công mặt bằng tuyến cống', required: true },
          { id: 'd-dwg-2', label: 'Bản vẽ trắc dọc', required: true },
          { id: 'd-dwg-3', label: 'Bản vẽ chi tiết hố ga', required: true },
        ],
      },
      {
        groupLabel: 'Chất lượng',
        items: [
          { id: 'd-qc-1', label: 'Biên bản nghiệm thu đào tuyến', required: true },
          { id: 'd-qc-2', label: 'Biên bản nghiệm thu lắp ống', required: true },
          { id: 'd-qc-3', label: 'Biên bản nghiệm thu hố ga', required: true },
          { id: 'd-qc-4', label: 'Kết quả thử kín / thử áp', required: true },
          { id: 'd-qc-5', label: 'Nhật ký thi công', required: true },
          { id: 'd-qc-6', label: 'Ảnh hiện trường đủ giai đoạn', required: true },
        ],
      },
    ],
  },
  {
    category: 'electrical',
    label: 'Điện chiếu sáng',
    icon: '💡',
    groups: [
      {
        groupLabel: 'Pháp lý',
        items: [
          { id: 'e-leg-1', label: 'Hợp đồng EPC / thi công', required: true },
          { id: 'e-leg-2', label: 'Giấy phép đấu nối điện lực', required: true },
        ],
      },
      {
        groupLabel: 'Bản vẽ',
        items: [
          { id: 'e-dwg-1', label: 'Sơ đồ nguyên lý cấp điện', required: true },
          { id: 'e-dwg-2', label: 'Mặt bằng tuyến cáp + cột đèn', required: true },
          { id: 'e-dwg-3', label: 'Chi tiết móng cột', required: true },
        ],
      },
      {
        groupLabel: 'Chất lượng',
        items: [
          { id: 'e-qc-1', label: 'Biên bản nghiệm thu móng cột', required: true },
          { id: 'e-qc-2', label: 'Biên bản nghiệm thu lắp cột + đèn', required: true },
          { id: 'e-qc-3', label: 'Kết quả đo điện trở tiếp địa', required: true },
          { id: 'e-qc-4', label: 'Kết quả đo cách điện', required: true },
          { id: 'e-qc-5', label: 'Biên bản chạy thử / phát quang', required: true },
        ],
      },
    ],
  },
];

// ============================================================
// Storage helpers
// ============================================================
function loadAllStates(): Record<string, HoanCongState> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveAllStates(map: Record<string, HoanCongState>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(map));
  } catch {
    /* ignore quota */
  }
}

// ============================================================
// Component
// ============================================================
export function HoanCongPage(): JSX.Element {
  const [allStates, setAllStates] = useState<Record<string, HoanCongState>>({});
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  useEffect(() => {
    const loaded = loadAllStates();
    setAllStates(loaded);
    const ids = Object.keys(loaded);
    if (ids.length > 0) setActiveProjectId(ids[0]!);
  }, []);

  const activeState = activeProjectId ? allStates[activeProjectId] : null;
  const activePreset = useMemo(
    () =>
      activeState
        ? PRESETS.find((p) => p.category === activeState.category)
        : null,
    [activeState],
  );

  // Stats
  const stats = useMemo(() => {
    if (!activeState || !activePreset) return null;
    const allItems = activePreset.groups.flatMap((g) => g.items);
    const required = allItems.filter((i) => i.required);
    const done = required.filter(
      (i) => activeState.itemStates[i.id]?.status === 'done',
    ).length;
    const preparing = required.filter(
      (i) => activeState.itemStates[i.id]?.status === 'preparing',
    ).length;
    const missing = required.length - done - preparing;
    const pct = required.length > 0 ? Math.round((done / required.length) * 100) : 0;
    return { total: required.length, done, preparing, missing, pct };
  }, [activeState, activePreset]);

  function createNew(category: HoanCongCategory, projectName: string): void {
    const id = `proj_${Date.now().toString(36)}`;
    const newState: HoanCongState = {
      category,
      projectName,
      itemStates: {},
      updatedAt: Date.now(),
    };
    const next = { ...allStates, [id]: newState };
    setAllStates(next);
    saveAllStates(next);
    setActiveProjectId(id);
  }

  function deleteProject(id: string): void {
    if (!window.confirm('Xóa checklist này?')) return;
    const next = { ...allStates };
    delete next[id];
    setAllStates(next);
    saveAllStates(next);
    if (activeProjectId === id) {
      setActiveProjectId(Object.keys(next)[0] ?? null);
    }
  }

  function setItemStatus(itemId: string, status: HoanCongStatus): void {
    if (!activeProjectId || !activeState) return;
    const nextItemStates = {
      ...activeState.itemStates,
      [itemId]: { ...activeState.itemStates[itemId], status },
    };
    const next: Record<string, HoanCongState> = {
      ...allStates,
      [activeProjectId]: {
        ...activeState,
        itemStates: nextItemStates,
        updatedAt: Date.now(),
      },
    };
    setAllStates(next);
    saveAllStates(next);
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
          <ClipboardCheck size={22} /> Checklist hồ sơ hoàn công
        </h2>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6B7280' }}>
          Tick từng mục: ✓ Đủ / ⏳ Đang chuẩn bị / ✗ Thiếu. Báo cáo % hoàn thành theo
          loại công trình. Lưu offline localStorage.
        </p>
      </div>

      {/* Sidebar projects + Add new */}
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16 }}>
        <aside
          style={{
            border: '1px solid var(--color-border-subtle, #E5E7EB)',
            borderRadius: 8,
            padding: 12,
            maxHeight: 'calc(100vh - 200px)',
            overflowY: 'auto',
          }}
        >
          <div style={{ marginBottom: 10, fontWeight: 600, fontSize: 12 }}>
            🏗 Tạo checklist mới
          </div>
          {PRESETS.map((p) => (
            <button
              key={p.category}
              type="button"
              onClick={() => {
                const name = window.prompt(
                  `Tên dự án ${p.label.toLowerCase()}:`,
                  '',
                );
                if (name?.trim()) createNew(p.category, name.trim());
              }}
              style={{
                width: '100%',
                padding: '8px 10px',
                marginBottom: 4,
                border: '1px solid var(--color-border-default, #D1D5DB)',
                borderRadius: 6,
                background: 'var(--color-surface-card, #fff)',
                fontSize: 12,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span>{p.icon}</span>
              <span>{p.label}</span>
              <Plus size={12} style={{ marginLeft: 'auto', color: '#9CA3AF' }} />
            </button>
          ))}

          <div style={{ marginTop: 16, fontWeight: 600, fontSize: 12 }}>
            📋 Đã tạo ({Object.keys(allStates).length})
          </div>
          {Object.entries(allStates).map(([id, s]) => {
            const preset = PRESETS.find((p) => p.category === s.category);
            return (
              <div
                key={id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  marginTop: 4,
                }}
              >
                <button
                  type="button"
                  onClick={() => setActiveProjectId(id)}
                  style={{
                    flex: 1,
                    padding: '6px 10px',
                    border: '1px solid var(--color-border-default, #D1D5DB)',
                    borderRadius: 6,
                    background:
                      activeProjectId === id
                        ? 'rgba(16, 185, 129, 0.1)'
                        : 'var(--color-surface-card, #fff)',
                    fontSize: 12,
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  {preset?.icon} {s.projectName}
                </button>
                <button
                  type="button"
                  onClick={() => deleteProject(id)}
                  style={{
                    padding: 4,
                    border: 'none',
                    background: 'transparent',
                    color: '#DC2626',
                    cursor: 'pointer',
                  }}
                  title="Xóa"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            );
          })}
        </aside>

        <main>
          {!activeState || !activePreset ? (
            <div
              style={{
                padding: 48,
                textAlign: 'center',
                border: '1px dashed var(--color-border-default, #D1D5DB)',
                borderRadius: 8,
                color: '#9CA3AF',
              }}
            >
              <ClipboardCheck size={48} style={{ marginBottom: 12 }} />
              <p>Chọn checklist từ sidebar hoặc tạo mới.</p>
            </div>
          ) : (
            <div>
              {/* Header */}
              <div
                style={{
                  marginBottom: 14,
                  padding: 16,
                  background: 'var(--color-surface-card, #F9FAFB)',
                  borderRadius: 8,
                  border: '1px solid var(--color-border-subtle, #E5E7EB)',
                }}
              >
                <div style={{ fontSize: 18, fontWeight: 700 }}>
                  {activePreset.icon} {activeState.projectName}
                </div>
                <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>
                  Loại: {activePreset.label} · Cập nhật:{' '}
                  {new Date(activeState.updatedAt).toLocaleString('vi-VN')}
                </div>
                {stats && (
                  <div style={{ marginTop: 12 }}>
                    <div
                      style={{
                        height: 8,
                        background: '#E5E7EB',
                        borderRadius: 4,
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${stats.pct}%`,
                          background:
                            stats.pct === 100
                              ? '#10B981'
                              : stats.pct >= 70
                                ? '#3B82F6'
                                : '#F59E0B',
                          transition: 'width 250ms',
                        }}
                      />
                    </div>
                    <div
                      style={{
                        marginTop: 6,
                        fontSize: 12,
                        display: 'flex',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span>
                        ✓ <strong>{stats.done}</strong> đủ · ⏳{' '}
                        <strong>{stats.preparing}</strong> đang chuẩn bị · ✗{' '}
                        <strong>{stats.missing}</strong> thiếu / {stats.total} mục
                        bắt buộc
                      </span>
                      <span style={{ fontWeight: 700 }}>{stats.pct}%</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Groups + items */}
              {activePreset.groups.map((group) => (
                <div
                  key={group.groupLabel}
                  style={{
                    marginBottom: 18,
                    border: '1px solid var(--color-border-subtle, #E5E7EB)',
                    borderRadius: 8,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      padding: '10px 16px',
                      background: 'var(--color-surface-muted, #F3F4F6)',
                      fontWeight: 600,
                      fontSize: 13,
                    }}
                  >
                    {group.groupLabel} ({group.items.length})
                  </div>
                  {group.items.map((item) => {
                    const state = activeState.itemStates[item.id];
                    return (
                      <div
                        key={item.id}
                        style={{
                          padding: '10px 16px',
                          borderTop: '1px solid var(--color-border-subtle, #E5E7EB)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          fontSize: 13,
                        }}
                      >
                        <span style={{ flex: 1 }}>
                          {item.label}
                          {item.required && (
                            <span style={{ color: '#DC2626', marginLeft: 4 }}>*</span>
                          )}
                        </span>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <StatusButton
                            active={state?.status === 'done'}
                            onClick={() => setItemStatus(item.id, 'done')}
                            color="#10B981"
                            icon={<CheckCircle2 size={14} />}
                            label="Đủ"
                          />
                          <StatusButton
                            active={state?.status === 'preparing'}
                            onClick={() => setItemStatus(item.id, 'preparing')}
                            color="#F59E0B"
                            icon={<Clock size={14} />}
                            label="Đang"
                          />
                          <StatusButton
                            active={state?.status === 'missing'}
                            onClick={() => setItemStatus(item.id, 'missing')}
                            color="#DC2626"
                            icon={<XCircle size={14} />}
                            label="Thiếu"
                          />
                          {!state?.status && (
                            <span style={{ color: '#9CA3AF', fontSize: 11, padding: '0 8px' }}>
                              <Circle size={12} /> Chưa
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function StatusButton({
  active,
  onClick,
  color,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  color: string;
  icon: React.ReactNode;
  label: string;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '4px 10px',
        border: `1px solid ${active ? color : '#D1D5DB'}`,
        borderRadius: 4,
        background: active ? `${color}20` : 'transparent',
        color: active ? color : '#6B7280',
        fontSize: 11,
        fontWeight: active ? 700 : 500,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
      }}
    >
      {icon} {label}
    </button>
  );
}
