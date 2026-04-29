/**
 * DatabaseVnPanel — Phase 19.24.2.
 *
 * Editor 4 collection database VN: standards / dinh_muc / vat_lieu / roads_vn.
 *
 * UI:
 *   - Top: 4 tabs (Quy chuẩn / Định mức / Vật liệu / Đường VN)
 *   - List items + search
 *   - Click → JSON editor inline (textarea) với schema hint
 *   - Save / Delete với confirm
 *   - "+ Thêm mới" với template JSON
 */

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@trishteam/auth/react';
import {
  DB_COLLECTIONS,
  type DatabaseCollection,
  type DbItem,
  deleteItem,
  getItemSubtitle,
  getItemTitle,
  listItems,
  saveItem,
} from '../lib/database-vn.js';
import { writeAudit } from '../lib/firestore-admin.js';

const NEW_TEMPLATE: Record<DatabaseCollection, string> = {
  standards: `{
  "id": "qcvn-xx-yyyy",
  "code": "QCVN XX:YYYY",
  "type": "qcvn",
  "name": "Tên đầy đủ",
  "year": 2024,
  "issuer": "Bộ Xây dựng",
  "scope": "Mô tả phạm vi áp dụng",
  "category": "xay-dung",
  "tags": []
}`,
  dinh_muc: `{
  "id": "ab.xxxxx",
  "code": "AB.XXXXX",
  "category": "be-tong",
  "name": "Tên công tác",
  "unit": "m3",
  "description": "Mô tả ngắn",
  "resources": [
    { "type": "vat-lieu", "name": "Xi măng", "unit": "kg", "qty": 350 },
    { "type": "nhan-cong", "name": "Bậc 3.5/7", "unit": "công", "qty": 1.2, "grade": "3.5/7" }
  ],
  "source": "QĐ 1776/2007/QĐ-BXD"
}`,
  vat_lieu: `{
  "id": "vat-lieu-xx",
  "name": "Tên vật liệu",
  "category": "xi-mang",
  "spec": "Thông số kỹ thuật",
  "standard": "TCVN 6260:2009",
  "brands": []
}`,
  roads_vn: `{
  "id": "ql-x",
  "code": "QL X",
  "name": "Quốc lộ X",
  "type": "quoc-lo",
  "start_point": "Tỉnh A",
  "end_point": "Tỉnh B",
  "length_km": 0,
  "provinces": []
}`,
};

export function DatabaseVnPanel(): JSX.Element {
  const { firebaseUser } = useAuth();
  const adminUid = firebaseUser?.uid ?? '';

  const [activeCol, setActiveCol] = useState<DatabaseCollection>('standards');
  const [items, setItems] = useState<DbItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<{
    id: string;
    json: string;
    isNew: boolean;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ text: string; tone: 'ok' | 'err' | 'warn' } | null>(null);

  function flash(tone: 'ok' | 'err' | 'warn', text: string): void {
    setToast({ text, tone });
    setTimeout(() => setToast(null), 4000);
  }

  async function loadItems(): Promise<void> {
    setLoading(true);
    try {
      const list = await listItems(activeCol);
      list.sort((a, b) => a._id.localeCompare(b._id));
      setItems(list);
    } catch (err) {
      flash('err', err instanceof Error ? err.message : String(err));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadItems();
    setEditing(null);
    setSearch('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCol]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => {
      const title = getItemTitle(it, activeCol).toLowerCase();
      const sub = getItemSubtitle(it, activeCol).toLowerCase();
      return title.includes(q) || sub.includes(q) || it._id.toLowerCase().includes(q);
    });
  }, [items, search, activeCol]);

  const colMeta = DB_COLLECTIONS.find((c) => c.id === activeCol)!;

  function startEdit(item: DbItem): void {
    setEditing({
      id: item._id,
      json: JSON.stringify(item, null, 2),
      isNew: false,
    });
  }

  function startNew(): void {
    setEditing({
      id: '',
      json: NEW_TEMPLATE[activeCol],
      isNew: true,
    });
  }

  async function handleSave(): Promise<void> {
    if (!editing) return;
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(editing.json) as Record<string, unknown>;
    } catch (err) {
      flash('err', `JSON không hợp lệ: ${err instanceof Error ? err.message : err}`);
      return;
    }
    const id = (parsed.id as string) || (parsed._id as string) || editing.id;
    if (!id || typeof id !== 'string') {
      flash('err', 'Field "id" bắt buộc và phải là chuỗi.');
      return;
    }
    setBusy(true);
    try {
      await saveItem(activeCol, id, parsed);
      try {
        await writeAudit({
          actor_uid: adminUid,
          action: editing.isNew ? 'db_vn_create' : 'db_vn_update',
          target_type: activeCol,
          target_id: id,
          target_label: getItemTitle({ _id: id, ...parsed }, activeCol),
        });
      } catch {
        /* ignore */
      }
      flash('ok', `✓ Đã lưu "${id}".`);
      setEditing(null);
      await loadItems();
    } catch (err) {
      flash('err', err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(item: DbItem): Promise<void> {
    if (!window.confirm(`Xóa "${getItemTitle(item, activeCol)}"? Không thể khôi phục.`)) {
      return;
    }
    setBusy(true);
    try {
      await deleteItem(activeCol, item._id);
      try {
        await writeAudit({
          actor_uid: adminUid,
          action: 'db_vn_delete',
          target_type: activeCol,
          target_id: item._id,
          target_label: getItemTitle(item, activeCol),
        });
      } catch {
        /* ignore */
      }
      flash('ok', `✓ Đã xóa "${item._id}".`);
      if (editing?.id === item._id) setEditing(null);
      await loadItems();
    } catch (err) {
      flash('err', err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel-content">
      <header className="panel-header">
        <h1>🇻🇳 Database Việt Nam</h1>
        <p className="muted">
          Sửa offline 4 bộ database. Lưu lên Firestore, web user load thấy ngay (cache 5 phút).
        </p>
      </header>

      {toast ? (
        <div
          className={`alert ${
            toast.tone === 'ok' ? 'alert-success' : toast.tone === 'warn' ? 'alert-warning' : 'alert-error'
          }`}
        >
          {toast.text}
        </div>
      ) : null}

      {/* Tabs */}
      <nav className="db-vn-tabs">
        {DB_COLLECTIONS.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`db-vn-tab ${activeCol === c.id ? 'active' : ''}`}
            onClick={() => setActiveCol(c.id)}
          >
            <span className="db-vn-tab-icon">{c.icon}</span>
            <div className="db-vn-tab-text">
              <strong>{c.label}</strong>
              <span className="muted small">{c.description}</span>
            </div>
          </button>
        ))}
      </nav>

      {/* Action bar */}
      <div className="db-vn-actionbar">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm theo mã, tên, ID..."
          className="db-vn-search"
        />
        <span className="muted small">
          {filtered.length} / {items.length} bản ghi
        </span>
        <button type="button" onClick={() => void loadItems()} className="btn btn-ghost btn-sm">
          🔄 Làm mới
        </button>
        <button type="button" onClick={startNew} className="btn btn-primary btn-sm" disabled={busy}>
          + Thêm mới
        </button>
      </div>

      {/* Layout: list trái + editor phải */}
      <div className="db-vn-layout">
        <aside className="db-vn-list">
          {loading ? (
            <div className="muted small">Đang tải…</div>
          ) : filtered.length === 0 ? (
            <div className="muted small">
              {items.length === 0
                ? 'Chưa có bản ghi. Bấm "Thêm mới" hoặc "Nạp tất cả" trong web admin.'
                : 'Không khớp tìm kiếm.'}
            </div>
          ) : (
            <ul className="db-vn-items">
              {filtered.map((item) => (
                <li
                  key={item._id}
                  className={`db-vn-item ${editing?.id === item._id ? 'active' : ''}`}
                >
                  <button
                    type="button"
                    onClick={() => startEdit(item)}
                    className="db-vn-item-main"
                  >
                    <strong>{getItemTitle(item, activeCol)}</strong>
                    <span className="muted small">{getItemSubtitle(item, activeCol)}</span>
                    <code className="muted small">{item._id}</code>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(item)}
                    className="db-vn-item-delete"
                    title="Xóa"
                    disabled={busy}
                  >
                    🗑
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <section className="db-vn-editor">
          {editing ? (
            <>
              <div className="db-vn-editor-header">
                <h3>
                  {editing.isNew ? '✨ Tạo mới' : '✏ Sửa'} — {colMeta.label}
                </h3>
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="btn btn-ghost btn-sm"
                  disabled={busy}
                >
                  ✕ Đóng
                </button>
              </div>

              <details className="schema-hint">
                <summary>📝 Schema gợi ý</summary>
                <pre>
                  <code>{colMeta.schemaHint}</code>
                </pre>
              </details>

              <textarea
                value={editing.json}
                onChange={(e) =>
                  setEditing({ ...editing, json: e.target.value })
                }
                className="db-vn-json-editor"
                spellCheck={false}
                placeholder="JSON object…"
              />

              <div className="db-vn-editor-actions">
                <button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={busy}
                  className="btn btn-primary"
                >
                  {busy ? '⏳ Đang lưu…' : '💾 Lưu'}
                </button>
                {!editing.isNew ? (
                  <button
                    type="button"
                    onClick={() => {
                      const item = items.find((it) => it._id === editing.id);
                      if (item) void handleDelete(item);
                    }}
                    disabled={busy}
                    className="btn btn-danger"
                  >
                    🗑 Xóa
                  </button>
                ) : null}
              </div>
            </>
          ) : (
            <div className="db-vn-empty">
              <p className="muted">Chọn 1 bản ghi bên trái để sửa, hoặc bấm <strong>+ Thêm mới</strong>.</p>
              <details>
                <summary>📝 Schema {colMeta.label}</summary>
                <pre><code>{colMeta.schemaHint}</code></pre>
              </details>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
