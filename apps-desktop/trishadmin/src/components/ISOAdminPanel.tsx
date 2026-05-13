/**
 * Phase 41 — ISOAdminPanel.
 *
 * Browse TrishISO projects cross-user (admin có quyền full read).
 * Schema: /HoSoTong/{projectId}, /MucLucItem/{...}, /TaiLieuDinhKem/{...}
 */
import { useEffect, useState } from 'react';
import { getFirebaseDb } from '@trishteam/auth';
import { collection, getDocs, query, where, limit } from 'firebase/firestore';

interface ISOProject {
  id: string;
  ten?: string;
  ten_du_an?: string;
  ma_du_an?: string;
  owner_uid?: string;
  created_at?: number;
  updated_at?: number;
  [key: string]: unknown;
}

export function ISOAdminPanel(): JSX.Element {
  const [projects, setProjects] = useState<ISOProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ISOProject | null>(null);
  const [items, setItems] = useState<unknown[]>([]);
  const [attachments, setAttachments] = useState<unknown[]>([]);
  const [filterUid, setFilterUid] = useState<string>('');

  useEffect(() => { void loadProjects(); }, []);

  async function loadProjects(): Promise<void> {
    setLoading(true);
    try {
      const db = getFirebaseDb();
      const snap = await getDocs(query(collection(db, 'HoSoTong'), limit(200)));
      setProjects(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ISOProject));
    } catch (err) {
      console.error('loadProjects', err);
    }
    setLoading(false);
  }

  async function openProject(p: ISOProject): Promise<void> {
    setSelected(p);
    setItems([]);
    setAttachments([]);
    try {
      const db = getFirebaseDb();
      const [itemsSnap, attsSnap] = await Promise.all([
        getDocs(query(collection(db, 'MucLucItem'), where('hoso_id', '==', p.id), limit(500))),
        getDocs(query(collection(db, 'TaiLieuDinhKem'), where('hoso_id', '==', p.id), limit(500))),
      ]);
      setItems(itemsSnap.docs.map((d) => d.data()));
      setAttachments(attsSnap.docs.map((d) => d.data()));
    } catch (err) {
      console.error('openProject', err);
    }
  }

  const filtered = filterUid ? projects.filter((p) => p.owner_uid?.includes(filterUid)) : projects;

  return (
    <div style={{ padding: 20 }}>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>📋 ISO Admin — Cross-user projects</h1>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 6 }}>
          Xem hồ sơ ISO 9001 của mọi user. Collections: <code>/HoSoTong</code>, <code>/MucLucItem</code>, <code>/TaiLieuDinhKem</code>.
        </p>
      </div>

      <div style={{ marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
        <input type="text" value={filterUid} onChange={(e) => setFilterUid(e.target.value)}
          placeholder="Filter theo owner_uid (1 phần UID)" style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--color-border-default)', background: 'var(--color-surface-bg)', fontSize: 12, width: 280 }} />
        <button type="button" onClick={() => void loadProjects()} style={{ padding: '6px 12px', fontSize: 12, borderRadius: 6, border: '1px solid var(--color-border-default)', background: 'transparent', cursor: 'pointer' }}>🔄</button>
        <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{filtered.length}/{projects.length} dự án</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 14, height: 'calc(100vh - 240px)', minHeight: 500 }}>
        <div style={{ background: 'var(--color-surface-card)', border: '1px solid var(--color-border-subtle)', borderRadius: 10, padding: 10, overflowY: 'auto' }}>
          {loading && <div style={muted}>⏳</div>}
          {!loading && filtered.length === 0 && <div style={muted}>Không có dự án</div>}
          {filtered.map((p) => (
            <button key={p.id} type="button" onClick={() => void openProject(p)}
              style={{ width: '100%', padding: 10, border: 'none', borderRadius: 6, marginBottom: 4, cursor: 'pointer', textAlign: 'left',
                background: selected?.id === p.id ? 'rgba(16,185,129,0.1)' : 'transparent', display: 'flex', flexDirection: 'column', gap: 2 }}>
              <strong style={{ fontSize: 12 }}>{p.ten_du_an || p.ten || p.id}</strong>
              <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{p.ma_du_an} · owner: {p.owner_uid?.slice(0, 10) ?? '—'}</span>
              {p.updated_at && <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{new Date(p.updated_at).toLocaleDateString('vi-VN')}</span>}
            </button>
          ))}
        </div>

        <div style={{ background: 'var(--color-surface-card)', border: '1px solid var(--color-border-subtle)', borderRadius: 10, padding: 14, overflowY: 'auto' }}>
          {!selected && <div style={muted}>← Chọn dự án để xem chi tiết</div>}
          {selected && (
            <>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 4px' }}>{selected.ten_du_an || selected.ten}</h2>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 12 }}>
                Mã: {selected.ma_du_an} · ID: {selected.id} · Owner: {selected.owner_uid}
              </div>

              <h3 style={{ fontSize: 13, fontWeight: 700, margin: '14px 0 6px' }}>📑 Mục lục ({items.length})</h3>
              <pre style={preStyle}>{JSON.stringify(items.slice(0, 20), null, 2)}</pre>

              <h3 style={{ fontSize: 13, fontWeight: 700, margin: '14px 0 6px' }}>📎 Tài liệu đính kèm ({attachments.length})</h3>
              <pre style={preStyle}>{JSON.stringify(attachments.slice(0, 20), null, 2)}</pre>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const muted: React.CSSProperties = { fontSize: 12, color: 'var(--color-text-muted)', padding: 8 };
const preStyle: React.CSSProperties = {
  fontSize: 10, padding: 8, background: 'var(--color-surface-row)', borderRadius: 6,
  maxHeight: 260, overflow: 'auto', fontFamily: 'monospace', lineHeight: 1.4,
};
