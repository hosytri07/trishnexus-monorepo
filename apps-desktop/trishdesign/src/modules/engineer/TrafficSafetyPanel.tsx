/**
 * Phase 14.4.5 — TrishDesign · 4. Vẽ hiện trạng An toàn giao thông
 *
 * Nhập dữ liệu (Excel/tay) → vẽ biển báo + vạch sơn + đèn tín hiệu trên AutoCAD.
 */

export function TrafficSafetyPanel(): JSX.Element {
  return (
    <div className="td-panel">
      <header className="td-panel-head">
        <h1>🚦 Vẽ hiện trạng An toàn giao thông</h1>
        <p className="td-lead">
          Nhập số liệu khảo sát ATGT → phần mềm đọc → tự động vẽ biển báo, vạch
          sơn, đèn tín hiệu trên AutoCAD theo QCVN 41.
        </p>
      </header>

      <section className="td-section">
        <h2 className="td-section-title">Cách nhập dữ liệu</h2>
        <div className="td-section-body">
          <div className="td-tile-grid">
            <div className="td-tile">📊 Import từ Excel</div>
            <div className="td-tile">✍ Nhập tay trong app</div>
            <div className="td-tile">📋 Paste từ clipboard</div>
          </div>
        </div>
      </section>

      <section className="td-section">
        <h2 className="td-section-title">Bộ tiêu chuẩn áp dụng</h2>
        <div className="td-section-body">
          <div className="td-tile-grid">
            <div className="td-tile">📜 QCVN 41 — Báo hiệu đường bộ</div>
            <div className="td-tile">📜 QCVN 83 — Đèn tín hiệu</div>
            <div className="td-tile">📜 TCCS 39 — ATGT trường học</div>
          </div>
        </div>
      </section>

      <section className="td-section">
        <h2 className="td-section-title">Bảng dữ liệu</h2>
        <div className="td-section-body">
          <table className="td-mini-table">
            <thead>
              <tr>
                <th>STT</th>
                <th>Lý trình</th>
                <th>Vị trí (T/P)</th>
                <th>Loại</th>
                <th>Mã hiệu</th>
                <th>Kích thước</th>
                <th>Tình trạng</th>
              </tr>
            </thead>
            <tbody>
              <tr><td colSpan={7} className="muted small" style={{ textAlign: 'center', padding: 16 }}>(Chưa có dữ liệu)</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="td-section">
        <h2 className="td-section-title">Phân loại</h2>
        <div className="td-section-body">
          <div className="td-chip-row">
            <span className="td-chip">⛔ Biển cấm (P.xxx)</span>
            <span className="td-chip">⚠ Biển nguy hiểm (W.xxx)</span>
            <span className="td-chip">🚧 Biển hiệu lệnh (R.xxx)</span>
            <span className="td-chip">📘 Biển chỉ dẫn (I.xxx)</span>
            <span className="td-chip">🟦 Biển phụ (S.xxx)</span>
            <span className="td-chip">🟨 Vạch sơn dọc</span>
            <span className="td-chip">🟨 Vạch sơn ngang</span>
            <span className="td-chip">🚥 Đèn tín hiệu</span>
            <span className="td-chip">🛑 Gờ giảm tốc</span>
          </div>
        </div>
      </section>

      <section className="td-section">
        <h2 className="td-section-title">Xuất bản vẽ</h2>
        <div className="td-section-body">
          <div className="td-action-row">
            <button type="button" className="btn btn-primary">🎨 Vẽ lên AutoCAD</button>
            <button type="button" className="btn btn-ghost">💾 Xuất .dxf</button>
            <button type="button" className="btn btn-ghost">📋 Copy LISP script</button>
            <button type="button" className="btn btn-ghost">📊 Xuất bảng thống kê (Excel)</button>
          </div>
        </div>
      </section>

      <footer className="td-panel-foot muted small">
        ⚠ Module demo — engine vẽ + thư viện block biển báo sẽ thêm ở phase sau.
      </footer>
    </div>
  );
}
