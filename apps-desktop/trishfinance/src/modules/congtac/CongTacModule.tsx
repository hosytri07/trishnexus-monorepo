/**
 * TrishFinance — MODULE CÔNG TÁC (02-09, anh Trí).
 *
 * Hai sổ trong một module:
 *   🧳 CHUYẾN CÔNG TÁC — ứng tiền (nhiều lần) → ghi chi theo mục (ăn uống /
 *      nhà nghỉ / mua hóa đơn / vé xe / phát sinh) → quyết toán: còn lại =
 *      ứng − chi (dương: còn thừa giữ lại · âm: bù thêm tiền túi).
 *   🏗 CÔNG TRÌNH NGOÀI — chỉ là CÁI TÊN tự đặt (không liên quan Văn phòng):
 *      các đợt nhận tiền − (chi khác + tổng chi các chuyến gắn vào) = còn lại.
 *
 * Liên thông sổ thu chi cá nhân: nút "Ghi sang sổ" — KHÔNG tự động, để khỏi
 * trùng; mỗi khoản chỉ ghi 1 lần (chặn theo refId). Xuất CSV bảng kê để nộp
 * quyết toán. Dữ liệu trong trishfinance_db như mọi module khác.
 */

import { useMemo, useState } from 'react';
import { Briefcase, Plus, Trash2, FileDown, BookmarkPlus, CheckCircle2, RotateCcw } from 'lucide-react';
import {
  useFinanceDb, money, dateVN, today, createId, toCsv, downloadBlob, appendLog,
} from '../../state';
import {
  TRIP_CATS,
  type TripExpenseCat, type CongTacTrip, type OutsideJob,
} from '../../types';
import { NumberInput } from '../../components/NumberInput';
import { useDialog } from '../../components/DialogProvider';

/* ── Tính toán ─────────────────────────────────────────────────────────── */

function tripAdvanceTotal(t: CongTacTrip): number {
  return t.advances.reduce((s, a) => s + a.amount, 0);
}
function tripExpenseTotal(t: CongTacTrip): number {
  return t.expenses.reduce((s, e) => s + e.amount, 0);
}
function tripRemain(t: CongTacTrip): number {
  return tripAdvanceTotal(t) - tripExpenseTotal(t);
}
function catLabel(cat: TripExpenseCat): string {
  const c = TRIP_CATS.find((x) => x.key === cat);
  return c ? `${c.icon} ${c.label}` : cat;
}

function jobIn(j: OutsideJob): number {
  return j.payments.reduce((s, p) => s + p.amount, 0);
}
function jobCostOwn(j: OutsideJob): number {
  return j.costs.reduce((s, c) => s + c.amount, 0);
}

/* ── Ô màu tiền: dương xanh, âm đỏ ─────────────────────────────────────── */
function MoneyTone({ value }: { value: number }): JSX.Element {
  const color = value > 0 ? 'var(--color-success, #16a34a)' : value < 0 ? 'var(--color-danger, #dc2626)' : 'var(--color-text-secondary)';
  return <span style={{ color, fontWeight: 700 }}>{money(value)}</span>;
}

const cellInput: React.CSSProperties = {
  width: '100%', background: 'transparent', border: '1px solid var(--color-border-subtle)',
  borderRadius: 8, padding: '6px 8px', fontSize: 13, color: 'var(--color-text-primary)',
};
const thStyle: React.CSSProperties = { textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', padding: '6px 8px', textTransform: 'uppercase', letterSpacing: 0.4 };
const tdStyle: React.CSSProperties = { padding: '4px 8px', verticalAlign: 'middle' };

export function CongTacModule(): JSX.Element {
  const { db, update } = useFinanceDb();
  const dialog = useDialog();
  const [tab, setTab] = useState<'chuyen' | 'congtrinh'>('chuyen');
  const [tripId, setTripId] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);

  const trips = db.congtacTrips ?? [];
  const jobs = db.outsideJobs ?? [];
  const trip = trips.find((t) => t.id === tripId) ?? null;
  const job = jobs.find((j) => j.id === jobId) ?? null;

  /** Tổng chi của công trình = chi khác + chi các chuyến gắn vào. */
  const jobTotalCost = useMemo(() => (j: OutsideJob): number => {
    const fromTrips = trips.filter((t) => t.jobId === j.id).reduce((s, t) => s + tripExpenseTotal(t), 0);
    return jobCostOwn(j) + fromTrips;
  }, [trips]);

  /* ── Chuyến: CRUD ─────────────────────────────────────────────────────── */

  function addTrip(): void {
    const t: CongTacTrip = {
      id: createId('trip'), name: `Chuyến ${trips.length + 1}`, place: '',
      dateFrom: today(), advances: [], expenses: [], status: 'dang_di', createdAt: today(),
    };
    update((d) => { d.congtacTrips.push(t); appendLog(d, `Tạo chuyến công tác "${t.name}"`, 'taichinh'); });
    setTripId(t.id);
  }
  function patchTrip(id: string, patch: Partial<CongTacTrip>): void {
    update((d) => {
      const t = d.congtacTrips.find((x) => x.id === id);
      if (t) Object.assign(t, patch);
    });
  }
  async function deleteTrip(t: CongTacTrip): Promise<void> {
    if (!(await dialog.confirm(`Xóa chuyến "${t.name}" (${t.expenses.length} khoản chi)?`, { variant: 'danger' }))) return;
    update((d) => { d.congtacTrips = d.congtacTrips.filter((x) => x.id !== t.id); });
    setTripId(null);
  }

  /* ── Chuyến: ghi sổ cá nhân (chặn ghi trùng theo refId) ───────────────── */

  async function tripToLedger(t: CongTacTrip): Promise<void> {
    const remain = tripRemain(t);
    if (remain === 0) { await dialog.alert('Ứng − chi = 0đ — không có gì để ghi sổ.'); return; }
    const existed = db.ledger.some((e) => e.fromModule === 'congtac' && e.refId === t.id);
    if (existed && !(await dialog.confirm('Chuyến này ĐÃ ghi sổ một lần rồi. Ghi thêm lần nữa?', { variant: 'danger' }))) return;
    const kind = remain > 0 ? 'thu' as const : 'chi' as const;
    if (!(await dialog.confirm(
      remain > 0
        ? `Ghi THU ${money(remain)} vào sổ cá nhân (tiền ứng còn thừa giữ lại)?`
        : `Ghi CHI ${money(-remain)} vào sổ cá nhân (bù tiền túi cho chuyến)?`,
    ))) return;
    update((d) => {
      d.ledger.push({
        id: createId('led'), date: today(), kind,
        category: kind === 'thu' ? 'khac_thu' : 'khac_chi',
        amount: Math.abs(remain),
        description: `${kind === 'thu' ? 'Còn lại' : 'Bù thiếu'} chuyến công tác: ${t.name}`,
        fromModule: 'congtac', refId: t.id, createdAt: new Date().toISOString(),
      });
      appendLog(d, `Ghi sổ ${kind} ${money(Math.abs(remain))} từ chuyến "${t.name}"`, 'taichinh');
    });
    await dialog.alert('✓ Đã ghi vào Sổ thu chi (module Tài chính cá nhân).');
  }

  /* ── Chuyến: xuất CSV bảng kê quyết toán ──────────────────────────────── */

  function exportTripCsv(t: CongTacTrip): void {
    const rows: (string | number)[][] = [
      ['BẢNG KÊ QUYẾT TOÁN CHUYẾN CÔNG TÁC'],
      ['Chuyến', t.name], ['Nơi đến', t.place ?? ''],
      ['Từ ngày', dateVN(t.dateFrom)], ['Đến ngày', t.dateTo ? dateVN(t.dateTo) : ''],
      ['Công trình', jobs.find((j) => j.id === t.jobId)?.name ?? ''],
      [],
      ['I. ỨNG TIỀN'], ['Ngày', 'Số tiền', 'Ghi chú'],
      ...t.advances.map((a) => [dateVN(a.date), a.amount, a.note ?? '']),
      ['Tổng ứng', tripAdvanceTotal(t), ''],
      [],
      ['II. CHI TIÊU'], ['Ngày', 'Mục', 'Nội dung', 'Số tiền'],
      ...t.expenses.map((e) => [dateVN(e.date), catLabel(e.cat).replace(/^[^ ]+ /, ''), e.desc, e.amount]),
      ['Tổng chi', '', '', tripExpenseTotal(t)],
      [],
      ['III. TỔNG HỢP THEO MỤC'],
      ...TRIP_CATS.map((c) => [c.label, t.expenses.filter((e) => e.cat === c.key).reduce((s, e) => s + e.amount, 0)]),
      [],
      ['CÒN LẠI (ứng − chi)', tripRemain(t)],
    ];
    downloadBlob(new Blob(['﻿' + toCsv(rows)], { type: 'text/csv;charset=utf-8' }), `quyet-toan-${t.name.replace(/[^\p{L}\d]+/gu, '-')}.csv`);
  }

  /* ── Công trình: CRUD + CSV ───────────────────────────────────────────── */

  function addJob(): void {
    const j: OutsideJob = {
      id: createId('job'), name: `Công trình ${jobs.length + 1}`, payments: [], costs: [],
      status: 'dang_lam', createdAt: today(),
    };
    update((d) => { d.outsideJobs.push(j); appendLog(d, `Tạo công trình ngoài "${j.name}"`, 'taichinh'); });
    setJobId(j.id);
  }
  function patchJob(id: string, patch: Partial<OutsideJob>): void {
    update((d) => {
      const j = d.outsideJobs.find((x) => x.id === id);
      if (j) Object.assign(j, patch);
    });
  }
  async function deleteJob(j: OutsideJob): Promise<void> {
    const linked = trips.filter((t) => t.jobId === j.id).length;
    if (!(await dialog.confirm(`Xóa công trình "${j.name}"?${linked ? ` (${linked} chuyến đang gắn sẽ thành chuyến độc lập)` : ''}`, { variant: 'danger' }))) return;
    update((d) => {
      d.outsideJobs = d.outsideJobs.filter((x) => x.id !== j.id);
      for (const t of d.congtacTrips) if (t.jobId === j.id) t.jobId = undefined;
    });
    setJobId(null);
  }

  async function paymentToLedger(j: OutsideJob, payId: string): Promise<void> {
    const p = j.payments.find((x) => x.id === payId);
    if (!p) return;
    const existed = db.ledger.some((e) => e.fromModule === 'congtac' && e.refId === p.id);
    if (existed && !(await dialog.confirm('Khoản nhận này ĐÃ ghi sổ rồi. Ghi thêm lần nữa?', { variant: 'danger' }))) return;
    if (!(await dialog.confirm(`Ghi THU ${money(p.amount)} (${j.name}) vào sổ cá nhân?`))) return;
    update((d) => {
      d.ledger.push({
        id: createId('led'), date: p.date, kind: 'thu', category: 'kinh_doanh',
        amount: p.amount, description: `Nhận tiền công trình: ${j.name}${p.note ? ` — ${p.note}` : ''}`,
        fromModule: 'congtac', refId: p.id, createdAt: new Date().toISOString(),
      });
      appendLog(d, `Ghi sổ thu ${money(p.amount)} từ công trình "${j.name}"`, 'taichinh');
    });
    await dialog.alert('✓ Đã ghi vào Sổ thu chi.');
  }

  function exportJobCsv(j: OutsideJob): void {
    const linkedTrips = trips.filter((t) => t.jobId === j.id);
    const rows: (string | number)[][] = [
      ['BẢNG KÊ CÔNG TRÌNH NGOÀI'], ['Công trình', j.name], ['Đối tác', j.partner ?? ''],
      [],
      ['I. CÁC ĐỢT NHẬN TIỀN'], ['Ngày', 'Số tiền', 'Ghi chú'],
      ...j.payments.map((p) => [dateVN(p.date), p.amount, p.note ?? '']),
      ['Tổng nhận', jobIn(j), ''],
      [],
      ['II. CHI KHÁC'], ['Ngày', 'Nội dung', 'Số tiền'],
      ...j.costs.map((c) => [dateVN(c.date), c.desc, c.amount]),
      ['Tổng chi khác', '', jobCostOwn(j)],
      [],
      ['III. CHI CÁC CHUYẾN CÔNG TÁC GẮN VÀO'], ['Chuyến', 'Số tiền'],
      ...linkedTrips.map((t) => [t.name, tripExpenseTotal(t)]),
      [],
      ['TỔNG CHI', jobTotalCost(j)],
      ['CÒN LẠI (nhận − chi)', jobIn(j) - jobTotalCost(j)],
    ];
    downloadBlob(new Blob(['﻿' + toCsv(rows)], { type: 'text/csv;charset=utf-8' }), `cong-trinh-${j.name.replace(/[^\p{L}\d]+/gu, '-')}.csv`);
  }

  /* ══ RENDER ═══════════════════════════════════════════════════════════ */

  const tabBtn = (id: 'chuyen' | 'congtrinh', label: string): JSX.Element => (
    <button
      onClick={() => setTab(id)}
      style={{
        padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
        background: tab === id ? 'var(--color-accent-soft)' : 'transparent',
        color: tab === id ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)',
      }}
    >{label}</button>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Briefcase style={{ width: 20, height: 20, color: 'var(--color-accent-primary)' }} />
        <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Công tác · Công trình ngoài</h1>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          {tabBtn('chuyen', `🧳 Chuyến công tác (${trips.length})`)}
          {tabBtn('congtrinh', `🏗 Công trình ngoài (${jobs.length})`)}
        </div>
      </div>

      {tab === 'chuyen' && (
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 14, alignItems: 'start' }}>
          {/* Danh sách chuyến */}
          <div className="card" style={{ padding: 10 }}>
            <button onClick={addTrip} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px 0', borderRadius: 10, border: '1px dashed var(--color-border-subtle)', background: 'transparent', color: 'var(--color-accent-primary)', fontWeight: 600, fontSize: 13, cursor: 'pointer', marginBottom: 8 }}>
              <Plus style={{ width: 15, height: 15 }} /> Chuyến mới
            </button>
            {trips.length === 0 && <p style={{ fontSize: 12, color: 'var(--color-text-muted)', textAlign: 'center', padding: 12 }}>Chưa có chuyến nào.</p>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[...trips].reverse().map((t) => {
                const remain = tripRemain(t);
                const sel = t.id === tripId;
                return (
                  <button key={t.id} onClick={() => setTripId(t.id)} style={{ textAlign: 'left', padding: '9px 10px', borderRadius: 10, cursor: 'pointer', border: sel ? '1px solid var(--color-accent-primary)' : '1px solid var(--color-border-subtle)', background: sel ? 'var(--color-accent-soft)' : 'transparent' }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--color-text-primary)' }}>
                      {t.status === 'da_quyet_toan' ? '✅ ' : '🧳 '}{t.name}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
                      {dateVN(t.dateFrom)}{t.dateTo ? ` → ${dateVN(t.dateTo)}` : ''}{t.place ? ` · ${t.place}` : ''}
                    </div>
                    <div style={{ fontSize: 12, marginTop: 3 }}>
                      Ứng {money(tripAdvanceTotal(t))} · Chi {money(tripExpenseTotal(t))} · Còn <MoneyTone value={remain} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Chi tiết chuyến */}
          {!trip ? (
            <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>
              Chọn một chuyến bên trái, hoặc bấm "Chuyến mới".
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Thông tin */}
              <div className="card">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)' }}>Tên chuyến
                    <input style={cellInput} value={trip.name} onChange={(e) => patchTrip(trip.id, { name: e.target.value })} />
                  </label>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)' }}>Nơi đến
                    <input style={cellInput} value={trip.place ?? ''} onChange={(e) => patchTrip(trip.id, { place: e.target.value })} />
                  </label>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)' }}>Từ ngày
                    <input type="date" style={cellInput} value={trip.dateFrom} onChange={(e) => patchTrip(trip.id, { dateFrom: e.target.value })} />
                  </label>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)' }}>Đến ngày
                    <input type="date" style={cellInput} value={trip.dateTo ?? ''} onChange={(e) => patchTrip(trip.id, { dateTo: e.target.value || undefined })} />
                  </label>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)' }}>Gắn công trình ngoài
                    <select style={cellInput} value={trip.jobId ?? ''} onChange={(e) => patchTrip(trip.id, { jobId: e.target.value || undefined })}>
                      <option value="">— Không (đi việc cơ quan/khác) —</option>
                      {jobs.map((j) => <option key={j.id} value={j.id}>{j.name}</option>)}
                    </select>
                  </label>
                </div>
              </div>

              {/* Ứng tiền */}
              <div className="card">
                <div className="card-header"><h2 className="card-title">💵 Ứng tiền ({trip.advances.length})</h2>
                  <button onClick={() => update((d) => { d.congtacTrips.find((x) => x.id === trip.id)?.advances.push({ id: createId('adv'), date: today(), amount: 0 }); })} style={{ marginLeft: 'auto', display: 'flex', gap: 4, alignItems: 'center', border: 'none', background: 'transparent', color: 'var(--color-accent-primary)', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}><Plus style={{ width: 14, height: 14 }} />Thêm lần ứng</button>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead><tr><th style={{ ...thStyle, width: 150 }}>Ngày</th><th style={{ ...thStyle, width: 170 }}>Số tiền</th><th style={thStyle}>Ghi chú</th><th style={{ width: 36 }} /></tr></thead>
                  <tbody>
                    {trip.advances.map((a) => (
                      <tr key={a.id}>
                        <td style={tdStyle}><input type="date" style={cellInput} value={a.date} onChange={(e) => update((d) => { const x = d.congtacTrips.find((t) => t.id === trip.id)?.advances.find((v) => v.id === a.id); if (x) x.date = e.target.value; })} /></td>
                        <td style={tdStyle}><NumberInput value={a.amount} suffix="đ" style={cellInput} onChange={(n) => update((d) => { const x = d.congtacTrips.find((t) => t.id === trip.id)?.advances.find((v) => v.id === a.id); if (x) x.amount = n; })} /></td>
                        <td style={tdStyle}><input style={cellInput} value={a.note ?? ''} placeholder="vd: ứng đợt 1" onChange={(e) => update((d) => { const x = d.congtacTrips.find((t) => t.id === trip.id)?.advances.find((v) => v.id === a.id); if (x) x.note = e.target.value; })} /></td>
                        <td style={tdStyle}><button onClick={() => update((d) => { const t = d.congtacTrips.find((x) => x.id === trip.id); if (t) t.advances = t.advances.filter((v) => v.id !== a.id); })} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-text-muted)' }}><Trash2 style={{ width: 14, height: 14 }} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Chi tiêu */}
              <div className="card">
                <div className="card-header"><h2 className="card-title">🧾 Chi tiêu ({trip.expenses.length})</h2>
                  <button onClick={() => update((d) => { d.congtacTrips.find((x) => x.id === trip.id)?.expenses.push({ id: createId('exp'), date: today(), cat: 'an_uong', desc: '', amount: 0 }); })} style={{ marginLeft: 'auto', display: 'flex', gap: 4, alignItems: 'center', border: 'none', background: 'transparent', color: 'var(--color-accent-primary)', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}><Plus style={{ width: 14, height: 14 }} />Thêm khoản chi</button>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead><tr><th style={{ ...thStyle, width: 140 }}>Ngày</th><th style={{ ...thStyle, width: 150 }}>Mục</th><th style={thStyle}>Nội dung</th><th style={{ ...thStyle, width: 160 }}>Số tiền</th><th style={{ width: 36 }} /></tr></thead>
                  <tbody>
                    {trip.expenses.map((ex) => (
                      <tr key={ex.id}>
                        <td style={tdStyle}><input type="date" style={cellInput} value={ex.date} onChange={(e) => update((d) => { const x = d.congtacTrips.find((t) => t.id === trip.id)?.expenses.find((v) => v.id === ex.id); if (x) x.date = e.target.value; })} /></td>
                        <td style={tdStyle}>
                          <select style={cellInput} value={ex.cat} onChange={(e) => update((d) => { const x = d.congtacTrips.find((t) => t.id === trip.id)?.expenses.find((v) => v.id === ex.id); if (x) x.cat = e.target.value as TripExpenseCat; })}>
                            {TRIP_CATS.map((c) => <option key={c.key} value={c.key}>{c.icon} {c.label}</option>)}
                          </select>
                        </td>
                        <td style={tdStyle}><input style={cellInput} value={ex.desc} placeholder="vd: cơm trưa 3 người" onChange={(e) => update((d) => { const x = d.congtacTrips.find((t) => t.id === trip.id)?.expenses.find((v) => v.id === ex.id); if (x) x.desc = e.target.value; })} /></td>
                        <td style={tdStyle}><NumberInput value={ex.amount} suffix="đ" style={cellInput} onChange={(n) => update((d) => { const x = d.congtacTrips.find((t) => t.id === trip.id)?.expenses.find((v) => v.id === ex.id); if (x) x.amount = n; })} /></td>
                        <td style={tdStyle}><button onClick={() => update((d) => { const t = d.congtacTrips.find((x) => x.id === trip.id); if (t) t.expenses = t.expenses.filter((v) => v.id !== ex.id); })} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-text-muted)' }}><Trash2 style={{ width: 14, height: 14 }} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {/* Tổng theo mục */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                  {TRIP_CATS.map((c) => {
                    const s = trip.expenses.filter((e) => e.cat === c.key).reduce((sum, e) => sum + e.amount, 0);
                    if (s === 0) return null;
                    return <span key={c.key} style={{ fontSize: 12, padding: '3px 10px', borderRadius: 99, background: 'var(--color-surface-muted)', color: 'var(--color-text-secondary)' }}>{c.icon} {c.label}: <b>{money(s)}</b></span>;
                  })}
                </div>
              </div>

              {/* Quyết toán */}
              <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 14 }}>
                  Tổng ứng <b>{money(tripAdvanceTotal(trip))}</b> − Tổng chi <b>{money(tripExpenseTotal(trip))}</b> = Còn lại <MoneyTone value={tripRemain(trip)} />
                  {tripRemain(trip) < 0 && <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}> (bù tiền túi)</span>}
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button onClick={() => patchTrip(trip.id, { status: trip.status === 'dang_di' ? 'da_quyet_toan' : 'dang_di' })} style={{ display: 'flex', gap: 5, alignItems: 'center', padding: '8px 12px', borderRadius: 10, border: '1px solid var(--color-border-subtle)', background: 'transparent', color: 'var(--color-text-primary)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    {trip.status === 'dang_di' ? <><CheckCircle2 style={{ width: 14, height: 14 }} /> Quyết toán xong</> : <><RotateCcw style={{ width: 14, height: 14 }} /> Mở lại chuyến</>}
                  </button>
                  <button onClick={() => void tripToLedger(trip)} style={{ display: 'flex', gap: 5, alignItems: 'center', padding: '8px 12px', borderRadius: 10, border: '1px solid var(--color-border-subtle)', background: 'transparent', color: 'var(--color-accent-primary)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}><BookmarkPlus style={{ width: 14, height: 14 }} /> Ghi sang sổ cá nhân</button>
                  <button onClick={() => exportTripCsv(trip)} style={{ display: 'flex', gap: 5, alignItems: 'center', padding: '8px 12px', borderRadius: 10, border: '1px solid var(--color-border-subtle)', background: 'transparent', color: 'var(--color-text-primary)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}><FileDown style={{ width: 14, height: 14 }} /> Xuất CSV</button>
                  <button onClick={() => void deleteTrip(trip)} style={{ display: 'flex', gap: 5, alignItems: 'center', padding: '8px 12px', borderRadius: 10, border: '1px solid var(--color-danger, #dc2626)', background: 'transparent', color: 'var(--color-danger, #dc2626)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}><Trash2 style={{ width: 14, height: 14 }} /> Xóa</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'congtrinh' && (
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 14, alignItems: 'start' }}>
          {/* Danh sách công trình */}
          <div className="card" style={{ padding: 10 }}>
            <button onClick={addJob} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px 0', borderRadius: 10, border: '1px dashed var(--color-border-subtle)', background: 'transparent', color: 'var(--color-accent-primary)', fontWeight: 600, fontSize: 13, cursor: 'pointer', marginBottom: 8 }}>
              <Plus style={{ width: 15, height: 15 }} /> Công trình mới
            </button>
            {jobs.length === 0 && <p style={{ fontSize: 12, color: 'var(--color-text-muted)', textAlign: 'center', padding: 12 }}>Chưa có công trình nào. Tên tự đặt — không liên quan hồ sơ cơ quan.</p>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[...jobs].reverse().map((j) => {
                const remain = jobIn(j) - jobTotalCost(j);
                const sel = j.id === jobId;
                return (
                  <button key={j.id} onClick={() => setJobId(j.id)} style={{ textAlign: 'left', padding: '9px 10px', borderRadius: 10, cursor: 'pointer', border: sel ? '1px solid var(--color-accent-primary)' : '1px solid var(--color-border-subtle)', background: sel ? 'var(--color-accent-soft)' : 'transparent' }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--color-text-primary)' }}>{j.status === 'xong' ? '✅ ' : '🏗 '}{j.name}</div>
                    <div style={{ fontSize: 12, marginTop: 3 }}>Nhận {money(jobIn(j))} · Chi {money(jobTotalCost(j))} · Còn <MoneyTone value={remain} /></div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Chi tiết công trình */}
          {!job ? (
            <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>
              Chọn một công trình bên trái, hoặc bấm "Công trình mới".
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="card">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)' }}>Tên công trình (tự đặt)
                    <input style={cellInput} value={job.name} onChange={(e) => patchJob(job.id, { name: e.target.value })} />
                  </label>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)' }}>Đối tác / ai thuê (tuỳ chọn)
                    <input style={cellInput} value={job.partner ?? ''} onChange={(e) => patchJob(job.id, { partner: e.target.value })} />
                  </label>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)' }}>Ghi chú
                    <input style={cellInput} value={job.note ?? ''} onChange={(e) => patchJob(job.id, { note: e.target.value })} />
                  </label>
                </div>
              </div>

              {/* Nhận tiền */}
              <div className="card">
                <div className="card-header"><h2 className="card-title">💰 Các đợt nhận tiền ({job.payments.length})</h2>
                  <button onClick={() => update((d) => { d.outsideJobs.find((x) => x.id === job.id)?.payments.push({ id: createId('pay'), date: today(), amount: 0 }); })} style={{ marginLeft: 'auto', display: 'flex', gap: 4, alignItems: 'center', border: 'none', background: 'transparent', color: 'var(--color-accent-primary)', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}><Plus style={{ width: 14, height: 14 }} />Thêm đợt nhận</button>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead><tr><th style={{ ...thStyle, width: 150 }}>Ngày</th><th style={{ ...thStyle, width: 170 }}>Số tiền</th><th style={thStyle}>Ghi chú</th><th style={{ ...thStyle, width: 90 }} /><th style={{ width: 36 }} /></tr></thead>
                  <tbody>
                    {job.payments.map((p) => (
                      <tr key={p.id}>
                        <td style={tdStyle}><input type="date" style={cellInput} value={p.date} onChange={(e) => update((d) => { const x = d.outsideJobs.find((j2) => j2.id === job.id)?.payments.find((v) => v.id === p.id); if (x) x.date = e.target.value; })} /></td>
                        <td style={tdStyle}><NumberInput value={p.amount} suffix="đ" style={cellInput} onChange={(n) => update((d) => { const x = d.outsideJobs.find((j2) => j2.id === job.id)?.payments.find((v) => v.id === p.id); if (x) x.amount = n; })} /></td>
                        <td style={tdStyle}><input style={cellInput} value={p.note ?? ''} placeholder="vd: đợt 1 sau khảo sát" onChange={(e) => update((d) => { const x = d.outsideJobs.find((j2) => j2.id === job.id)?.payments.find((v) => v.id === p.id); if (x) x.note = e.target.value; })} /></td>
                        <td style={tdStyle}><button onClick={() => void paymentToLedger(job, p.id)} title="Ghi khoản nhận này vào Sổ thu chi cá nhân" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-accent-primary)', fontSize: 12, fontWeight: 600 }}>📒 Ghi sổ</button></td>
                        <td style={tdStyle}><button onClick={() => update((d) => { const j2 = d.outsideJobs.find((x) => x.id === job.id); if (j2) j2.payments = j2.payments.filter((v) => v.id !== p.id); })} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-text-muted)' }}><Trash2 style={{ width: 14, height: 14 }} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Chi khác */}
              <div className="card">
                <div className="card-header"><h2 className="card-title">🧾 Chi khác ({job.costs.length}) — ngoài các chuyến đã gắn</h2>
                  <button onClick={() => update((d) => { d.outsideJobs.find((x) => x.id === job.id)?.costs.push({ id: createId('cost'), date: today(), desc: '', amount: 0 }); })} style={{ marginLeft: 'auto', display: 'flex', gap: 4, alignItems: 'center', border: 'none', background: 'transparent', color: 'var(--color-accent-primary)', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}><Plus style={{ width: 14, height: 14 }} />Thêm khoản chi</button>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead><tr><th style={{ ...thStyle, width: 150 }}>Ngày</th><th style={thStyle}>Nội dung</th><th style={{ ...thStyle, width: 170 }}>Số tiền</th><th style={{ width: 36 }} /></tr></thead>
                  <tbody>
                    {job.costs.map((c) => (
                      <tr key={c.id}>
                        <td style={tdStyle}><input type="date" style={cellInput} value={c.date} onChange={(e) => update((d) => { const x = d.outsideJobs.find((j2) => j2.id === job.id)?.costs.find((v) => v.id === c.id); if (x) x.date = e.target.value; })} /></td>
                        <td style={tdStyle}><input style={cellInput} value={c.desc} placeholder="vd: thuê máy đo, in hồ sơ..." onChange={(e) => update((d) => { const x = d.outsideJobs.find((j2) => j2.id === job.id)?.costs.find((v) => v.id === c.id); if (x) x.desc = e.target.value; })} /></td>
                        <td style={tdStyle}><NumberInput value={c.amount} suffix="đ" style={cellInput} onChange={(n) => update((d) => { const x = d.outsideJobs.find((j2) => j2.id === job.id)?.costs.find((v) => v.id === c.id); if (x) x.amount = n; })} /></td>
                        <td style={tdStyle}><button onClick={() => update((d) => { const j2 = d.outsideJobs.find((x) => x.id === job.id); if (j2) j2.costs = j2.costs.filter((v) => v.id !== c.id); })} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-text-muted)' }}><Trash2 style={{ width: 14, height: 14 }} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Chuyến gắn vào */}
              <div className="card">
                <h2 className="card-title">🧳 Chuyến công tác gắn vào công trình này</h2>
                {trips.filter((t) => t.jobId === job.id).length === 0 ? (
                  <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: '6px 0 0' }}>Chưa có — mở một chuyến bên tab 🧳 và chọn "Gắn công trình ngoài".</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                    {trips.filter((t) => t.jobId === job.id).map((t) => (
                      <button key={t.id} onClick={() => { setTab('chuyen'); setTripId(t.id); }} style={{ textAlign: 'left', display: 'flex', justifyContent: 'space-between', padding: '8px 10px', borderRadius: 10, border: '1px solid var(--color-border-subtle)', background: 'transparent', cursor: 'pointer', color: 'var(--color-text-primary)', fontSize: 13 }}>
                        <span>{t.status === 'da_quyet_toan' ? '✅' : '🧳'} {t.name} · {dateVN(t.dateFrom)}</span>
                        <b>{money(tripExpenseTotal(t))}</b>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Tổng kết */}
              <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 14 }}>
                  Nhận <b>{money(jobIn(job))}</b> − Chi <b>{money(jobTotalCost(job))}</b> = Còn lại <MoneyTone value={jobIn(job) - jobTotalCost(job)} />
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button onClick={() => patchJob(job.id, { status: job.status === 'dang_lam' ? 'xong' : 'dang_lam' })} style={{ display: 'flex', gap: 5, alignItems: 'center', padding: '8px 12px', borderRadius: 10, border: '1px solid var(--color-border-subtle)', background: 'transparent', color: 'var(--color-text-primary)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    {job.status === 'dang_lam' ? <><CheckCircle2 style={{ width: 14, height: 14 }} /> Đánh dấu xong</> : <><RotateCcw style={{ width: 14, height: 14 }} /> Mở lại</>}
                  </button>
                  <button onClick={() => exportJobCsv(job)} style={{ display: 'flex', gap: 5, alignItems: 'center', padding: '8px 12px', borderRadius: 10, border: '1px solid var(--color-border-subtle)', background: 'transparent', color: 'var(--color-text-primary)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}><FileDown style={{ width: 14, height: 14 }} /> Xuất CSV</button>
                  <button onClick={() => void deleteJob(job)} style={{ display: 'flex', gap: 5, alignItems: 'center', padding: '8px 12px', borderRadius: 10, border: '1px solid var(--color-danger, #dc2626)', background: 'transparent', color: 'var(--color-danger, #dc2626)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}><Trash2 style={{ width: 14, height: 14 }} /> Xóa</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
