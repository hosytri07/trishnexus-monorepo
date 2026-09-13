/**
 * TitleBlockPanel — Tạo khung tên bản vẽ tự động.
 *
 * UI scaffold: form thông tin khung tên + chọn template/khổ giấy + quản lý bộ
 * bản vẽ (đánh số STT tự động) + nút "Chèn vào AutoCAD" (nối acad_com khi đã có
 * block .dwg mẫu của Trí). Dữ liệu form lưu localStorage.
 *
 * Khi Trí gửi file .dwg khung tên → chuyển thành block ATTRIBUTE với tag khớp
 * `ATTR_TAGS` bên dưới, panel sẽ chèn block + điền giá trị.
 */

import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { invoke } from '@tauri-apps/api/core';

const LS_KEY = 'trishdesign.titleblock.v1';

/** Map field → tag ATTRIBUTE trong block AutoCAD (đặt khi tạo block từ form Trí). */
const ATTR_TAGS = {
  ten_congtrinh: 'TEN_CONGTRINH',
  hang_muc: 'HANG_MUC',
  ten_banve: 'TEN_BANVE',
  so_hieu: 'SO_HIEU',
  ty_le: 'TYLE',
  nguoi_ve: 'NGUOI_VE',
  kiem_tra: 'KIEM_TRA',
  chu_tri: 'CHU_TRI',
  ngay: 'NGAY',
  co_quan: 'CO_QUAN',
  revision: 'REVISION',
} as const;

interface TitleBlockForm {
  ten_congtrinh: string;
  hang_muc: string;
  ten_banve: string;
  so_hieu: string;
  ty_le: string;
  kho_giay: string;
  nguoi_ve: string;
  kiem_tra: string;
  chu_tri: string;
  ngay: string;
  co_quan: string;
  revision: string;
  template: string;
}

interface DrawingRow {
  stt: number;
  ten_banve: string;
  so_hieu: string;
  ty_le: string;
}

const PAPER_SIZES = ['A0', 'A1', 'A2', 'A3', 'A4'];
const TEMPLATES = [
  { id: 'tcvn', label: 'TCVN mặc định' },
  { id: 'sgtvt_dn', label: 'Sở GTVT Đà Nẵng' },
  { id: 'cong_ty', label: 'Mẫu công ty' },
];

function defaultForm(): TitleBlockForm {
  return {
    ten_congtrinh: '', hang_muc: '', ten_banve: '', so_hieu: '',
    ty_le: '1/100', kho_giay: 'A3', nguoi_ve: '', kiem_tra: '',
    chu_tri: '', ngay: new Date().toLocaleDateString('vi-VN'),
    co_quan: '', revision: '0', template: 'tcvn',
  };
}

function loadForm(): TitleBlockForm {
  try {
    const v = localStorage.getItem(LS_KEY);
    if (v) return { ...defaultForm(), ...JSON.parse(v) };
  } catch { /* ignore */ }
  return defaultForm();
}

function isInTauri(): boolean {
  return typeof window !== 'undefined' &&
    // @ts-expect-error tauri internal
    typeof window.__TAURI_INTERNALS__ !== 'undefined';
}

export function TitleBlockPanel(): JSX.Element {
  const [form, setForm] = useState<TitleBlockForm>(() => loadForm());
  const [rows, setRows] = useState<DrawingRow[]>([]);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(form)); } catch { /* ignore */ }
  }, [form]);

  function set<K extends keyof TitleBlockForm>(k: K, v: TitleBlockForm[K]): void {
    setForm((prev) => ({ ...prev, [k]: v }));
  }
  function showFlash(m: string): void { setFlash(m); setTimeout(() => setFlash(null), 2500); }

  function addRowFromForm(): void {
    setRows((prev) => [
      ...prev,
      { stt: prev.length + 1, ten_banve: form.ten_banve, so_hieu: form.so_hieu, ty_le: form.ty_le },
    ]);
  }
  function delRow(i: number): void {
    setRows((prev) => prev.filter((_, idx) => idx !== i).map((r, idx) => ({ ...r, stt: idx + 1 })));
  }

  async function handleInsertToCad(): Promise<void> {
    if (!isInTauri()) { showFlash('Chèn AutoCAD chỉ chạy trong app desktop.'); return; }
    try {
      // TODO: nối thực sự khi đã có block .dwg khung tên (insert + set attribute
      // theo ATTR_TAGS). Hiện chỉ kiểm tra AutoCAD đang chạy.
      await invoke('autocad_check_running');
      showFlash('(Demo) Sẽ chèn khung tên + điền attribute khi đã nạp block .dwg mẫu.');
    } catch (e) { showFlash(`✗ ${String(e)}`); }
  }

  function handlePullFromIso(): void {
    // TODO: lấy thông tin công trình từ module ISO (event bus / shared store).
    showFlash('Sẽ lấy thông tin dự án từ module Hồ sơ ISO (đang nối).');
  }

  const sectionStyle: CSSProperties = { marginBottom: 12 };
  const bodyStyle: CSSProperties = { padding: '10px 14px' };
  const fieldStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 3 };
  const labelStyle: CSSProperties = { fontSize: 11, fontWeight: 600 };

  const field = (label: string, key: keyof TitleBlockForm, placeholder = '') => (
    <div style={fieldStyle}>
      <span style={labelStyle}>{label}</span>
      <input
        className="td-input"
        value={form[key]}
        onChange={(e) => set(key, e.target.value)}
        placeholder={placeholder}
        style={{ padding: '6px 10px' }}
      />
    </div>
  );

  return (
    <div className="td-panel">
      <header className="td-panel-head" style={{ paddingBottom: 8 }}>
        <h1 style={{ marginBottom: 4 }}>🗂 Tạo khung tên bản vẽ tự động</h1>
        <p className="td-lead" style={{ fontSize: 12, marginBottom: 0 }}>
          Nhập 1 lần → sinh khung tên (block ATTRIBUTE) chèn vào AutoCAD, đánh số bộ bản vẽ tự động.
        </p>
        {flash && <span className="td-saved-flash">{flash}</span>}
      </header>

      {/* Cấu hình */}
      <section className="td-section" style={sectionStyle}>
        <h2 className="td-section-title" style={{ fontSize: 13 }}>① Mẫu khung tên & khổ giấy</h2>
        <div className="td-section-body" style={{ ...bodyStyle, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <div style={fieldStyle}>
            <span style={labelStyle}>Template</span>
            <select className="td-input" value={form.template} onChange={(e) => set('template', e.target.value)} style={{ padding: '6px 10px' }}>
              {TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>
          <div style={fieldStyle}>
            <span style={labelStyle}>Khổ giấy</span>
            <select className="td-input" value={form.kho_giay} onChange={(e) => set('kho_giay', e.target.value)} style={{ padding: '6px 10px' }}>
              {PAPER_SIZES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div style={{ ...fieldStyle, justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={handlePullFromIso}>📥 Lấy thông tin từ ISO</button>
          </div>
          <p className="muted small" style={{ width: '100%', margin: 0 }}>
            ⚠ Chưa có file .dwg khung tên mẫu — gửi file để mình tạo block ATTRIBUTE khớp các tag: {Object.values(ATTR_TAGS).join(', ')}.
          </p>
        </div>
      </section>

      {/* Thông tin khung tên */}
      <section className="td-section" style={sectionStyle}>
        <h2 className="td-section-title" style={{ fontSize: 13 }}>② Thông tin khung tên</h2>
        <div className="td-section-body" style={{ ...bodyStyle, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          {field('Tên công trình', 'ten_congtrinh', 'VD: Nâng cấp QL14B...')}
          {field('Hạng mục', 'hang_muc')}
          {field('Tên bản vẽ', 'ten_banve')}
          {field('Số hiệu bản vẽ', 'so_hieu', 'VD: 01, KT-02...')}
          {field('Tỷ lệ', 'ty_le', '1/100')}
          {field('Cơ quan', 'co_quan')}
          {field('Người vẽ', 'nguoi_ve')}
          {field('Kiểm tra', 'kiem_tra')}
          {field('Chủ trì', 'chu_tri')}
          {field('Ngày', 'ngay')}
          {field('Revision', 'revision')}
        </div>
        <div className="dos-action-bar" style={{ gap: 6, padding: '0 14px 12px' }}>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => void handleInsertToCad()}>✏ Chèn khung tên vào AutoCAD</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={addRowFromForm}>➕ Thêm vào bộ bản vẽ</button>
        </div>
      </section>

      {/* Bộ bản vẽ + đánh số */}
      <section className="td-section" style={sectionStyle}>
        <h2 className="td-section-title" style={{ fontSize: 13 }}>③ Bộ bản vẽ — đánh số tự động ({rows.length})</h2>
        <div className="td-section-body" style={{ padding: rows.length ? 0 : '10px 14px' }}>
          {rows.length === 0 ? (
            <p className="muted small" style={{ textAlign: 'center', margin: 0 }}>
              Chưa có bản vẽ nào. Điền thông tin ở trên rồi bấm "➕ Thêm vào bộ bản vẽ". (Import từ Excel — sẽ bổ sung.)
            </p>
          ) : (
            <div className="atgt-table-wrap" style={{ maxHeight: 300 }}>
              <table className="atgt-table" style={{ fontSize: 12 }}>
                <thead><tr><th style={{ width: 50 }}>STT</th><th>Tên bản vẽ</th><th>Số hiệu</th><th>Tỷ lệ</th><th style={{ width: 40 }}></th></tr></thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i}>
                      <td>{r.stt}</td>
                      <td>{r.ten_banve}</td>
                      <td>{r.so_hieu}</td>
                      <td>{r.ty_le}</td>
                      <td><button type="button" className="atgt-del-btn" onClick={() => delRow(i)}>🗑</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
