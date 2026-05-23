/**
 * Phase 38.6.6 — Module Tài liệu nội bộ (Company Documents).
 *
 * Quy định / quy chế / thủ tục / biểu mẫu công ty (KHÁC ISO chất lượng).
 * Lưu localStorage `trishoffice:documents`. Phase 2+ thêm file upload + version.
 */

import { useMemo, useState } from 'react';
import { Plus, Search, Edit2, Trash2, X, FileText, ExternalLink } from 'lucide-react';
import { useCollection, formatDate, today } from '../storage';
import { usePermission } from '../auth/usePermission';
import type { CompanyDocument, DocumentCategory } from '../types';

const CAT_LABEL: Record<DocumentCategory, { label: string; emoji: string; color: string }> = {
  regulation: { label: 'Quy định', emoji: '📜', color: '#DC2626' },
  policy: { label: 'Quy chế', emoji: '⚖️', color: '#7C3AED' },
  procedure: { label: 'Thủ tục', emoji: '📋', color: '#3B82F6' },
  form: { label: 'Biểu mẫu', emoji: '📝', color: 'var(--color-accent-primary, #10B981)' },
  announcement: { label: 'Thông báo', emoji: '📢', color: '#F59E0B' },
  training: { label: 'Đào tạo', emoji: '🎓', color: '#8B5CF6' },
  other: { label: 'Khác', emoji: '📄', color: 'var(--color-text-muted, #6B7280)' },
};

const STATUS_LABEL: Record<'draft' | 'active' | 'obsolete', { label: string; color: string }> = {
  draft: { label: 'Nháp', color: 'var(--color-text-muted, #9CA3AF)' },
  active: { label: 'Hiệu lực', color: 'var(--color-accent-primary, #10B981)' },
  obsolete: { label: 'Hết hiệu lực', color: '#DC2626' },
};

export function DocumentsPage(): JSX.Element {
  const { items, create, update, remove } = useCollection<CompanyDocument>(
    'documents', 'doc',
  );
  const perm = usePermission('documents');
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState<'all' | DocumentCategory>('all');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CompanyDocument | null>(null);
  const [viewing, setViewing] = useState<CompanyDocument | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((d) => {
      if (catFilter !== 'all' && d.category !== catFilter) return false;
      if (!q) return true;
      return (
        d.title.toLowerCase().includes(q) ||
        d.doc_code.toLowerCase().includes(q) ||
        (d.content ?? '').toLowerCase().includes(q) ||
        (d.department ?? '').toLowerCase().includes(q)
      );
    });
  }, [items, search, catFilter]);

  function openCreate(): void {
    setEditing(null);
    setShowForm(true);
  }

  function openEdit(d: CompanyDocument): void {
    setEditing(d);
    setShowForm(true);
  }

  function handleDelete(d: CompanyDocument): void {
    if (!window.confirm(`Xóa "${d.title}"?`)) return;
    remove(d.id);
  }

  return (
    <div>
      <div className="app-header">
        <h1>💼 Tài liệu nội bộ ({items.length})</h1>
        <p>
          Quy định, quy chế, thủ tục, biểu mẫu công ty (KHÁC TrishISO ISO chất
          lượng). Phase 2+ sẽ thêm file upload + version control.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {perm.can('create') && (
          <button type="button" className="btn-primary" onClick={openCreate}>
            <Plus size={14} /> Thêm tài liệu
          </button>
        )}
        <div style={{ flex: 1, minWidth: 220, position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--color-text-muted, #9CA3AF)' }} />
          <input
            type="text"
            placeholder="Search mã / tiêu đề / nội dung / phòng ban…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field"
            style={{ paddingLeft: 32 }}
          />
        </div>
        <select
          value={catFilter}
          onChange={(e) => setCatFilter(e.target.value as 'all' | DocumentCategory)}
          className="input-field"
          style={{ width: 'auto', minWidth: 140 }}
        >
          <option value="all">Tất cả loại</option>
          {Object.entries(CAT_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v.emoji} {v.label}</option>
          ))}
        </select>
      </div>

      <div style={tableWrap}>
        <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
          <thead style={thead}>
            <tr>
              <th style={th}>Mã</th>
              <th style={th}>Loại</th>
              <th style={th}>Tiêu đề</th>
              <th style={th}>Phòng ban</th>
              <th style={th}>Phiên bản</th>
              <th style={th}>Ban hành</th>
              <th style={th}>Trạng thái</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-muted, #9CA3AF)' }}>
                  <FileText size={36} style={{ marginBottom: 6, opacity: 0.4 }} />
                  <div>Chưa có tài liệu nào.</div>
                </td>
              </tr>
            ) : (
              filtered.map((d) => {
                const cat = CAT_LABEL[d.category];
                const st = STATUS_LABEL[d.status];
                return (
                  <tr key={d.id} style={tr}>
                    <td style={td}><code>{d.doc_code}</code></td>
                    <td style={td}>
                      <span style={{ padding: '2px 6px', borderRadius: 4, background: `${cat.color}20`, color: cat.color, fontSize: 11, fontWeight: 600 }}>
                        {cat.emoji} {cat.label}
                      </span>
                    </td>
                    <td style={td}>
                      <button
                        type="button"
                        onClick={() => setViewing(d)}
                        style={{ background: 'transparent', border: 'none', padding: 0, color: 'var(--color-text-link, #2563EB)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', fontWeight: 600 }}
                      >
                        {d.title}
                      </button>
                    </td>
                    <td style={td}>{d.department ?? '—'}</td>
                    <td style={td}>{d.version ?? '—'}</td>
                    <td style={td}>{d.issued_date ? formatDate(d.issued_date) : '—'}</td>
                    <td style={td}>
                      <span style={{ padding: '2px 8px', borderRadius: 4, background: `${st.color}20`, color: st.color, fontSize: 11, fontWeight: 600 }}>
                        {st.label}
                      </span>
                    </td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>
                      {perm.can('edit') && (
                        <button type="button" onClick={() => openEdit(d)} style={iconBtn}><Edit2 size={13} /></button>
                      )}
                      {perm.can('delete') && (
                        <button type="button" onClick={() => handleDelete(d)} style={{ ...iconBtn, color: '#DC2626' }}><Trash2 size={13} /></button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {viewing && <DocumentViewer doc={viewing} onClose={() => setViewing(null)} />}

      {showForm && (
        <DocumentFormModal
          initial={editing}
          onSave={(data) => {
            if (editing) update(editing.id, data);
            else create(data);
            setShowForm(false);
          }}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  );
}

const tableWrap: React.CSSProperties = {
  border: '1px solid var(--color-border-subtle, #E5E7EB)',
  borderRadius: 10, overflow: 'hidden',
};
const thead: React.CSSProperties = {
  background: 'var(--color-surface-muted, #F3F4F6)',
  fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em',
};
const th: React.CSSProperties = { padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--color-text-muted, #6B7280)' };
const td: React.CSSProperties = { padding: '10px 12px', verticalAlign: 'top' };
const tr: React.CSSProperties = { borderTop: '1px solid var(--color-border-subtle, #E5E7EB)' };
const iconBtn: React.CSSProperties = {
  padding: 6, border: 'none', background: 'transparent', cursor: 'pointer',
  color: 'var(--color-text-muted, #6B7280)', borderRadius: 4,
};

// ============================================================
// Viewer (read-only nội dung)
// ============================================================
function DocumentViewer({ doc, onClose }: { doc: CompanyDocument; onClose: () => void }): JSX.Element {
  const cat = CAT_LABEL[doc.category];
  return (
    <div style={modalBackdrop}>
      <div style={modalBox} onClick={(e) => e.stopPropagation()}>
        <div style={modalHead}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted, #9CA3AF)', marginBottom: 2 }}>
              <code>{doc.doc_code}</code> · {cat.emoji} {cat.label}
            </div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{doc.title}</h3>
          </div>
          <button type="button" onClick={onClose} style={closeBtn}><X size={18} /></button>
        </div>
        <div style={{ padding: 20, overflowY: 'auto', flex: 1, fontSize: 13, lineHeight: 1.65 }}>
          {doc.content ? (
            <div style={{ whiteSpace: 'pre-wrap' }}>{doc.content}</div>
          ) : doc.file_path ? (
            <div style={{ padding: 16, background: 'rgba(59,130,246,0.08)', borderRadius: 8 }}>
              <ExternalLink size={14} style={{ marginRight: 6 }} />
              File: <code>{doc.file_path}</code>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted, #6B7280)', marginTop: 4 }}>
                💡 Phase 2+ sẽ mở trực tiếp qua file picker.
              </div>
            </div>
          ) : (
            <div style={{ color: 'var(--color-text-muted, #9CA3AF)', textAlign: 'center', padding: 32 }}>
              (Không có nội dung)
            </div>
          )}
          <hr style={{ margin: '20px 0', border: 'none', borderTop: '1px solid var(--color-border-subtle, #E5E7EB)' }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, fontSize: 12 }}>
            <div><strong>Phòng ban:</strong> {doc.department ?? '—'}</div>
            <div><strong>Phiên bản:</strong> {doc.version ?? '—'}</div>
            <div><strong>Ngày ban hành:</strong> {doc.issued_date ? formatDate(doc.issued_date) : '—'}</div>
            <div><strong>Người ban hành:</strong> {doc.issued_by ?? '—'}</div>
          </div>
        </div>
        <div style={modalFooter}>
          <button type="button" onClick={onClose} style={cancelBtn}>Đóng</button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Form
// ============================================================
function DocumentFormModal({
  initial, onSave, onClose,
}: {
  initial: CompanyDocument | null;
  onSave: (data: Omit<CompanyDocument, 'id' | 'created_at' | 'updated_at'>) => void;
  onClose: () => void;
}): JSX.Element {
  const [form, setForm] = useState<Omit<CompanyDocument, 'id' | 'created_at' | 'updated_at'>>(() =>
    initial
      ? {
          doc_code: initial.doc_code, title: initial.title, category: initial.category,
          content: initial.content, file_path: initial.file_path,
          department: initial.department, issued_date: initial.issued_date,
          version: initial.version, issued_by: initial.issued_by,
          status: initial.status, notes: initial.notes,
        }
      : { doc_code: '', title: '', category: 'regulation', status: 'draft', issued_date: today(), version: '1.0' },
  );
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(): void {
    if (!form.doc_code.trim()) return setError('Mã không được trống');
    if (!form.title.trim()) return setError('Tiêu đề không được trống');
    onSave(form);
  }

  return (
    <div style={modalBackdrop}>
      <div style={modalBox} onClick={(e) => e.stopPropagation()}>
        <div style={modalHead}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
            {initial ? '✏️ Sửa tài liệu' : '➕ Thêm tài liệu'}
          </h3>
          <button type="button" onClick={onClose} style={closeBtn}><X size={18} /></button>
        </div>
        <div style={{ padding: 20, display: 'grid', gap: 12, overflowY: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
            <Field label="Mã *">
              <input className="input-field" value={form.doc_code}
                onChange={(e) => setForm({ ...form, doc_code: e.target.value })}
                placeholder="QD-NS-001" />
            </Field>
            <Field label="Loại *">
              <select className="input-field" value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value as DocumentCategory })}>
                {Object.entries(CAT_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>{v.emoji} {v.label}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Tiêu đề *">
            <input className="input-field" value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="vd: Quy định về thời gian làm việc và nghỉ phép" />
          </Field>
          <Field label="Nội dung (markdown / plain text)">
            <textarea className="input-field" value={form.content ?? ''}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              rows={6} style={{ resize: 'vertical', fontFamily: 'inherit' }}
              placeholder="Nội dung chi tiết..." />
          </Field>
          <Field label="Hoặc đường dẫn file (PDF/DOCX)">
            <input className="input-field" value={form.file_path ?? ''}
              onChange={(e) => setForm({ ...form, file_path: e.target.value })}
              placeholder="vd: D:\Cty\QD-NS-001.pdf hoặc URL Google Drive" />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            <Field label="Phòng ban áp dụng">
              <input className="input-field" value={form.department ?? ''}
                onChange={(e) => setForm({ ...form, department: e.target.value })}
                placeholder="vd: Toàn công ty / Phòng kỹ thuật" />
            </Field>
            <Field label="Phiên bản">
              <input className="input-field" value={form.version ?? ''}
                onChange={(e) => setForm({ ...form, version: e.target.value })}
                placeholder="1.0" />
            </Field>
            <Field label="Ngày ban hành">
              <input type="date" className="input-field" value={form.issued_date ?? ''}
                onChange={(e) => setForm({ ...form, issued_date: e.target.value })} />
            </Field>
            <Field label="Người ban hành">
              <input className="input-field" value={form.issued_by ?? ''}
                onChange={(e) => setForm({ ...form, issued_by: e.target.value })}
                placeholder="vd: Giám đốc" />
            </Field>
            <Field label="Trạng thái">
              <select className="input-field" value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as 'draft' | 'active' | 'obsolete' })}>
                <option value="draft">Nháp</option>
                <option value="active">Hiệu lực</option>
                <option value="obsolete">Hết hiệu lực</option>
              </select>
            </Field>
          </div>
        </div>
        {error && (
          <div style={{ margin: '0 20px 12px', padding: 10, background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 6, color: '#DC2626', fontSize: 12 }}>
            ⚠ {error}
          </div>
        )}
        <div style={modalFooter}>
          <button type="button" onClick={onClose} style={cancelBtn}>Hủy</button>
          <button type="button" onClick={handleSubmit} className="btn-primary">
            {initial ? 'Cập nhật' : 'Lưu'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted, #6B7280)', marginBottom: 4 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const modalBackdrop: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 99999,
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
};
const modalBox: React.CSSProperties = {
  background: 'var(--color-surface-card, #fff)', borderRadius: 12,
  width: '100%', maxWidth: 720, maxHeight: '90vh',
  display: 'flex', flexDirection: 'column',
  color: 'var(--color-text-primary, #1F2937)',
};
const modalHead: React.CSSProperties = {
  padding: '14px 20px', borderBottom: '1px solid var(--color-border-subtle, #E5E7EB)',
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
};
const modalFooter: React.CSSProperties = {
  padding: '12px 20px', borderTop: '1px solid var(--color-border-subtle, #E5E7EB)',
  display: 'flex', justifyContent: 'flex-end', gap: 8,
};
const closeBtn: React.CSSProperties = {
  padding: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-text-muted, #6B7280)',
};
const cancelBtn: React.CSSProperties = {
  padding: '8px 16px', border: '1px solid var(--color-border-default, #D1D5DB)',
  borderRadius: 8, background: 'transparent', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit',
};
