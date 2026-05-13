/**
 * Phase 41 — OfficeAdminPanel.
 *
 * Admin browser cho TrishOffice multi-tenant (Phase 40.3).
 * Schema: /trishoffice_companies/{ownerUid}/co_<companyId>__<collection>/{docId}
 *
 * Flow:
 *   1. List user có data TrishOffice (query Sessions hoặc Users)
 *   2. Pick user → fetch /trishoffice_companies/{uid}/companies (top-level collection)
 *      Note: with new scoping, "companies" is GLOBAL (not scoped) → just "companies"
 *   3. Pick company → list các collection scoped (employees, attendance, assets, workflows, ...)
 *   4. Click collection → table preview docs
 */
import { useEffect, useState } from 'react';
import { getFirebaseDb } from '@trishteam/auth';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';

interface UserMeta {
  uid: string;
  email?: string;
  display_name?: string;
  role?: string;
  has_office?: boolean;
}

interface Company {
  id: string;
  name: string;
  code?: string;
  owner_uid?: string;
  created_at?: number;
}

const OFFICE_COLLECTIONS = ['employees', 'attendance', 'assets', 'workflows', 'documents', 'payroll', 'departments', 'contracts', 'expenses', 'taxes'];

export function OfficeAdminPanel(): JSX.Element {
  const [users, setUsers] = useState<UserMeta[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [collectionData, setCollectionData] = useState<Record<string, unknown[]>>({});
  const [activeCollection, setActiveCollection] = useState<string>('employees');

  useEffect(() => { void loadUsers(); }, []);

  async function loadUsers(): Promise<void> {
    setLoadingUsers(true);
    try {
      const db = getFirebaseDb();
      // List Firebase users từ TrishUser collection (top 100)
      const snap = await getDocs(query(collection(db, 'TrishUser'), orderBy('updated_at', 'desc'), limit(100)));
      const list: UserMeta[] = snap.docs.map((d) => {
        const data = d.data() as { email?: string; display_name?: string; role?: string };
        return { uid: d.id, email: data.email, display_name: data.display_name, role: data.role };
      });
      setUsers(list);
    } catch (err) {
      console.error('loadUsers', err);
    }
    setLoadingUsers(false);
  }

  async function loadCompaniesFor(uid: string): Promise<void> {
    setSelectedUid(uid);
    setSelectedCompanyId(null);
    setCompanies([]);
    setCollectionData({});
    setLoadingCompanies(true);
    try {
      const db = getFirebaseDb();
      const snap = await getDocs(collection(db, 'trishoffice_companies', uid, 'companies'));
      const list: Company[] = snap.docs.map((d) => d.data() as Company);
      setCompanies(list);
    } catch (err) {
      console.error('loadCompanies', err);
    }
    setLoadingCompanies(false);
  }

  async function loadCollection(uid: string, companyId: string, col: string): Promise<void> {
    setActiveCollection(col);
    try {
      const db = getFirebaseDb();
      const collName = `co_${companyId}__${col}`;
      const snap = await getDocs(collection(db, 'trishoffice_companies', uid, collName));
      setCollectionData((prev) => ({ ...prev, [col]: snap.docs.map((d) => d.data()) }));
    } catch (err) {
      console.error('loadCollection', col, err);
      setCollectionData((prev) => ({ ...prev, [col]: [] }));
    }
  }

  function selectCompany(c: Company): void {
    setSelectedCompanyId(c.id);
    if (selectedUid) void loadCollection(selectedUid, c.id, activeCollection);
  }

  return (
    <div style={{ padding: 20 }}>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>🏢 Office Admin — Multi-tenant Browser</h1>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 6, lineHeight: 1.6 }}>
          Xem data TrishOffice cross-company. Path Firestore: <code>/trishoffice_companies/{'{'}uid{'}'}/co_{'{'}companyId{'}'}__{'{'}collection{'}'}/{'{'}docId{'}'}</code>
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '260px 240px 1fr', gap: 14, height: 'calc(100vh - 200px)', minHeight: 500 }}>
        <Pane title={`👤 Users (${users.length})`}>
          {loadingUsers && <div style={muted}>⏳ Loading...</div>}
          {users.map((u) => (
            <button key={u.uid} type="button" onClick={() => void loadCompaniesFor(u.uid)}
              style={{ ...rowBtn, background: selectedUid === u.uid ? 'rgba(16,185,129,0.1)' : 'transparent' }}>
              <strong style={{ fontSize: 12 }}>{u.display_name || u.email || u.uid.slice(0, 10)}</strong>
              <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{u.email}</span>
              <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{u.role ?? '—'}</span>
            </button>
          ))}
        </Pane>

        <Pane title={`🏢 Companies ${selectedUid ? `(${companies.length})` : ''}`}>
          {!selectedUid && <div style={muted}>← Chọn user</div>}
          {selectedUid && loadingCompanies && <div style={muted}>⏳</div>}
          {selectedUid && !loadingCompanies && companies.length === 0 && <div style={muted}>User chưa có cty</div>}
          {companies.map((c) => (
            <button key={c.id} type="button" onClick={() => selectCompany(c)}
              style={{ ...rowBtn, background: selectedCompanyId === c.id ? 'rgba(16,185,129,0.1)' : 'transparent' }}>
              <strong style={{ fontSize: 12 }}>{c.name}</strong>
              <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{c.code} · {c.id.slice(0, 8)}</span>
            </button>
          ))}
        </Pane>

        <Pane title={`📋 Data ${selectedCompanyId ? `· ${activeCollection}` : ''}`}>
          {!selectedCompanyId && <div style={muted}>← Chọn company</div>}
          {selectedCompanyId && selectedUid && (
            <>
              <div style={{ display: 'flex', gap: 4, marginBottom: 10, flexWrap: 'wrap' }}>
                {OFFICE_COLLECTIONS.map((c) => (
                  <button key={c} type="button" onClick={() => void loadCollection(selectedUid, selectedCompanyId, c)}
                    style={{ padding: '4px 8px', fontSize: 11, borderRadius: 6, border: '1px solid var(--color-border-default)',
                      background: activeCollection === c ? 'rgba(16,185,129,0.15)' : 'transparent', cursor: 'pointer' }}>
                    {c} ({collectionData[c]?.length ?? '?'})
                  </button>
                ))}
              </div>
              <DataTable rows={collectionData[activeCollection] ?? []} />
            </>
          )}
        </Pane>
      </div>
    </div>
  );
}

function Pane({ title, children }: { title: string; children: React.ReactNode }): JSX.Element {
  return (
    <div style={{ background: 'var(--color-surface-card)', border: '1px solid var(--color-border-subtle)', borderRadius: 10, padding: 12, overflowY: 'auto' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );
}

function DataTable({ rows }: { rows: unknown[] }): JSX.Element {
  if (rows.length === 0) return <div style={muted}>Không có dữ liệu</div>;
  const keys = Object.keys(rows[0] as object).slice(0, 6);
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--color-border-default)' }}>
            {keys.map((k) => <th key={k} style={{ padding: '6px 4px', textAlign: 'left', fontWeight: 700, color: 'var(--color-text-muted)' }}>{k}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 50).map((r, i) => (
            <tr key={i} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
              {keys.map((k) => <td key={k} style={{ padding: '6px 4px', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{formatCell((r as Record<string, unknown>)[k])}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > 50 && <div style={{ ...muted, marginTop: 6, fontSize: 10 }}>Hiển thị 50/{rows.length} bản ghi</div>}
    </div>
  );
}

function formatCell(v: unknown): string {
  if (v == null) return '—';
  if (typeof v === 'number') {
    if (v > 1e12) return new Date(v).toLocaleString('vi-VN'); // timestamp ms
    return v.toLocaleString('vi-VN');
  }
  if (typeof v === 'object') return JSON.stringify(v).slice(0, 80);
  return String(v).slice(0, 80);
}

const rowBtn: React.CSSProperties = {
  width: '100%', padding: '8px 10px', border: 'none', borderRadius: 6,
  background: 'transparent', cursor: 'pointer', textAlign: 'left',
  display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 4,
};

const muted: React.CSSProperties = { fontSize: 12, color: 'var(--color-text-muted)', padding: 8 };
