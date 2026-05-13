/* eslint-disable @next/next/no-img-element */
'use client';

/**
 * /admin/trishoffice — Phase 41.
 *
 * Multi-tenant browser cho TrishOffice (Phase 40.3 data scoping per-company).
 * Path: /trishoffice_companies/{ownerUid}/co_<companyId>__<collection>/{docId}
 *
 * 3 cột: Users -> Companies -> Collections+Data preview.
 */

import { useEffect, useState } from 'react';
import { collection, getDocs, limit, query } from 'firebase/firestore';
import { requireDb } from '@/lib/firebase';
import { Building, Users as UsersIcon, FileText } from 'lucide-react';

interface UserMeta { uid: string; email?: string; display_name?: string; role?: string }
interface Company { id: string; name: string; code?: string; owner_uid?: string }

const OFFICE_COLLECTIONS = ['employees', 'attendance', 'assets', 'workflows', 'documents', 'payroll', 'departments', 'contracts', 'expenses', 'taxes'];

export default function AdminTrishOfficePage() {
  const [users, setUsers] = useState<UserMeta[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [collectionData, setCollectionData] = useState<Record<string, unknown[]>>({});
  const [activeCollection, setActiveCollection] = useState<string>('employees');

  useEffect(() => { void loadUsers(); }, []);

  async function loadUsers() {
    setLoadingUsers(true);
    try {
      const db = requireDb();
      const snap = await getDocs(query(collection(db, 'users'), limit(200)));
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

  async function loadCompaniesFor(uid: string) {
    setSelectedUid(uid); setSelectedCompanyId(null); setCompanies([]); setCollectionData({});
    setLoadingCompanies(true);
    try {
      const db = requireDb();
      const snap = await getDocs(collection(db, 'trishoffice_companies', uid, 'companies'));
      setCompanies(snap.docs.map((d) => d.data() as Company));
    } catch (err) { console.error('loadCompanies', err); }
    setLoadingCompanies(false);
  }

  async function loadCollection(uid: string, companyId: string, col: string) {
    setActiveCollection(col);
    try {
      const db = requireDb();
      const collName = `co_${companyId}__${col}`;
      const snap = await getDocs(collection(db, 'trishoffice_companies', uid, collName));
      setCollectionData((prev) => ({ ...prev, [col]: snap.docs.map((d) => d.data()) }));
    } catch (err) {
      console.error('loadCollection', col, err);
      setCollectionData((prev) => ({ ...prev, [col]: [] }));
    }
  }

  function selectCompany(c: Company) {
    setSelectedCompanyId(c.id);
    if (selectedUid) void loadCollection(selectedUid, c.id, activeCollection);
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-5">
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
          <Building className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">TrishOffice — Multi-tenant Browser</h1>
          <p className="text-sm text-zinc-400 mt-1">Phase 40.3 data scoping per-company. Path: <code className="bg-zinc-900 px-1.5 py-0.5 rounded text-xs">/trishoffice_companies/{`{uid}`}/co_{`{cmpId}`}__{`{col}`}</code></p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px,240px,1fr] gap-3" style={{ minHeight: 600 }}>
        <Pane title={`👤 Users (${users.length})`} icon={<UsersIcon className="w-4 h-4" />}>
          {loadingUsers && <p className="text-xs text-zinc-500">⏳</p>}
          {users.map((u) => (
            <button key={u.uid} onClick={() => void loadCompaniesFor(u.uid)}
              className={`w-full text-left px-3 py-2 rounded text-xs mb-1 ${selectedUid === u.uid ? 'bg-emerald-500/15' : 'hover:bg-zinc-800'}`}>
              <div className="font-semibold truncate">{u.display_name || u.email || u.uid.slice(0, 10)}</div>
              <div className="text-zinc-500 truncate">{u.email}</div>
              <div className="text-zinc-500">{u.role ?? '—'}</div>
            </button>
          ))}
        </Pane>

        <Pane title={`🏢 Companies ${selectedUid ? `(${companies.length})` : ''}`} icon={<Building className="w-4 h-4" />}>
          {!selectedUid && <p className="text-xs text-zinc-500">← Chọn user</p>}
          {selectedUid && loadingCompanies && <p className="text-xs text-zinc-500">⏳</p>}
          {selectedUid && !loadingCompanies && companies.length === 0 && <p className="text-xs text-zinc-500">Chưa có cty</p>}
          {companies.map((c) => (
            <button key={c.id} onClick={() => selectCompany(c)}
              className={`w-full text-left px-3 py-2 rounded text-xs mb-1 ${selectedCompanyId === c.id ? 'bg-emerald-500/15' : 'hover:bg-zinc-800'}`}>
              <div className="font-semibold truncate">{c.name}</div>
              <div className="text-zinc-500 truncate">{c.code} · {c.id.slice(0, 8)}</div>
            </button>
          ))}
        </Pane>

        <Pane title={`📋 Data ${selectedCompanyId ? `· ${activeCollection}` : ''}`} icon={<FileText className="w-4 h-4" />}>
          {!selectedCompanyId && <p className="text-xs text-zinc-500">← Chọn company</p>}
          {selectedCompanyId && selectedUid && (
            <>
              <div className="flex flex-wrap gap-1 mb-3">
                {OFFICE_COLLECTIONS.map((c) => (
                  <button key={c} onClick={() => void loadCollection(selectedUid, selectedCompanyId, c)}
                    className={`text-xs px-2 py-1 rounded border border-zinc-800 ${activeCollection === c ? 'bg-emerald-500/15' : 'hover:bg-zinc-800'}`}>
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

function Pane({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-3 overflow-y-auto" style={{ maxHeight: 700 }}>
      <div className="flex items-center gap-2 text-xs font-bold text-zinc-400 uppercase tracking-wide mb-2 pb-2 border-b border-zinc-800">
        {icon} {title}
      </div>
      {children}
    </div>
  );
}

function DataTable({ rows }: { rows: unknown[] }) {
  if (rows.length === 0) return <p className="text-xs text-zinc-500">Không có dữ liệu</p>;
  const keys = Object.keys(rows[0] as object).slice(0, 6);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="border-b border-zinc-800">
          <tr>{keys.map((k) => <th key={k} className="text-left px-2 py-1 font-bold text-zinc-400">{k}</th>)}</tr>
        </thead>
        <tbody>
          {rows.slice(0, 50).map((r, i) => (
            <tr key={i} className="border-b border-zinc-800/50">
              {keys.map((k) => <td key={k} className="px-2 py-1 max-w-[150px] truncate">{formatCell((r as Record<string, unknown>)[k])}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > 50 && <p className="text-xs text-zinc-500 mt-2">Hiển thị 50/{rows.length}</p>}
    </div>
  );
}

function formatCell(v: unknown): string {
  if (v == null) return '—';
  if (typeof v === 'number') {
    if (v > 1e12) return new Date(v).toLocaleString('vi-VN');
    return v.toLocaleString('vi-VN');
  }
  if (typeof v === 'object') return JSON.stringify(v).slice(0, 80);
  return String(v).slice(0, 80);
}
