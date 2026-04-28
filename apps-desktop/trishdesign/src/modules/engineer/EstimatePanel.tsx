/**
 * Phase 14.4.5 — TrishDesign · 8. Dự toán
 *
 * Nhập khối lượng → tra cứu định mức → bảng dự toán + xuất Excel/Word.
 */

export function EstimatePanel(): JSX.Element {
  return (
    <div className="td-panel">
      <header className="td-panel-head">
        <h1>💰 Dự toán</h1>
        <p className="td-lead">
          Nhập khối lượng theo mã hiệu công việc → tra cứu định mức + đơn giá → tự
          động sinh bảng tổng hợp dự toán + xuất Excel/Word.
        </p>
      </header>

      <section className="td-section">
        <h2 className="td-section-title">Cấu hình bộ định mức</h2>
        <div className="td-section-body">
          <div className="td-form-row">
            <label className="td-field">Bộ định mức<select><option>1776 — Xây dựng cơ bản</option><option>1777 — Lắp đặt</option><option>1778 — Khảo sát</option><option>588 — Sửa chữa</option><option>235 — Quản lý vận hành</option></select></label>
            <label className="td-field">Khu vực<select><option>Vùng I — TP.HCM, HN</option><option>Vùng II</option><option>Vùng III</option><option>Vùng IV</option></select></label>
            <label className="td-field">Năm áp dụng<input type="number" defaultValue={2025} /></label>
            <label className="td-field">Bộ đơn giá<select><option>UBND tỉnh ban hành</option><option>Tự nhập</option></select></label>
          </div>
        </div>
      </section>

      <section className="td-section">
        <h2 className="td-section-title">Khối lượng công việc</h2>
        <div className="td-section-body">
          <table className="td-mini-table">
            <thead><tr><th>STT</th><th>Mã hiệu</th><th>Tên công việc</th><th>Đơn vị</th><th>Khối lượng</th><th>Đơn giá</th><th>Thành tiền</th></tr></thead>
            <tbody><tr><td colSpan={7} className="muted small" style={{ textAlign: 'center', padding: 16 }}>(Chưa có dòng — bấm + để thêm hoặc Import Excel)</td></tr></tbody>
          </table>
          <div className="td-action-row" style={{ marginTop: 8 }}>
            <button type="button" className="btn btn-ghost">＋ Thêm hạng mục</button>
            <button type="button" className="btn btn-ghost">📊 Import từ Excel</button>
            <button type="button" className="btn btn-ghost">🔍 Tra cứu mã hiệu</button>
          </div>
        </div>
      </section>

      <section className="td-section">
        <h2 className="td-section-title">Tổng hợp</h2>
        <div className="td-section-body">
          <div className="td-stat-grid">
            <div className="td-stat-card"><span className="td-stat-icon">💵</span><div><div className="td-stat-label">Tổng chi phí trực tiếp</div><div className="td-stat-value">0 ₫</div></div></div>
            <div className="td-stat-card"><span className="td-stat-icon">📈</span><div><div className="td-stat-label">Chi phí chung + lãi</div><div className="td-stat-value">0 ₫</div></div></div>
            <div className="td-stat-card"><span className="td-stat-icon">🧾</span><div><div className="td-stat-label">Thuế VAT 10%</div><div className="td-stat-value">0 ₫</div></div></div>
            <div className="td-stat-card"><span className="td-stat-icon">💰</span><div><div className="td-stat-label">Tổng dự toán</div><div className="td-stat-value">0 ₫</div></div></div>
          </div>
        </div>
      </section>

      <section className="td-section">
        <h2 className="td-section-title">Xuất báo cáo</h2>
        <div className="td-section-body">
          <div className="td-action-row">
            <button type="button" className="btn btn-primary">📊 Xuất Excel chi tiết</button>
            <button type="button" className="btn btn-ghost">📄 Xuất Word thuyết minh</button>
            <button type="button" className="btn btn-ghost">📋 Xuất bảng tổng hợp</button>
          </div>
        </div>
      </section>

      <footer className="td-panel-foot muted small">
        ⚠ Module demo — engine tra định mức + tính dự toán sẽ thêm ở phase sau.
      </footer>
    </div>
  );
}
