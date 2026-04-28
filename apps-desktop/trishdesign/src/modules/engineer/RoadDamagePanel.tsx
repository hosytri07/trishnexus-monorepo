/**
 * Phase 14.4.5 — TrishDesign · 3. Vẽ hiện trạng hư hỏng mặt đường
 *
 * Nhập dữ liệu (Excel hoặc tay) → phần mềm đọc → vẽ trên AutoCAD.
 */

export function RoadDamagePanel(): JSX.Element {
  return (
    <div className="td-panel">
      <header className="td-panel-head">
        <h1>🛣 Vẽ hiện trạng hư hỏng mặt đường</h1>
        <p className="td-lead">
          Nhập số liệu khảo sát → phần mềm đọc hiểu → tự động vẽ bản vẽ hiện trạng
          hư hỏng trên AutoCAD (qua DXF hoặc lệnh script).
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
        <h2 className="td-section-title">Bảng dữ liệu hư hỏng</h2>
        <div className="td-section-body">
          <table className="td-mini-table">
            <thead>
              <tr>
                <th>STT</th>
                <th>Lý trình bắt đầu (Km)</th>
                <th>Lý trình kết thúc (Km)</th>
                <th>Loại hư hỏng</th>
                <th>Mức độ</th>
                <th>Diện tích (m²)</th>
                <th>Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              <tr><td colSpan={7} className="muted small" style={{ textAlign: 'center', padding: 16 }}>(Chưa có dữ liệu — import Excel hoặc bấm + để thêm dòng)</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="td-section">
        <h2 className="td-section-title">Loại hư hỏng (theo TCVN 8865)</h2>
        <div className="td-section-body">
          <div className="td-chip-row">
            <span className="td-chip">Nứt dọc</span>
            <span className="td-chip">Nứt ngang</span>
            <span className="td-chip">Nứt mai rùa</span>
            <span className="td-chip">Nứt khối</span>
            <span className="td-chip">Ổ gà</span>
            <span className="td-chip">Bong tróc</span>
            <span className="td-chip">Lún vệt bánh xe</span>
            <span className="td-chip">Đẩy trồi</span>
            <span className="td-chip">Chảy nhựa</span>
            <span className="td-chip">Vá sửa</span>
          </div>
        </div>
      </section>

      <section className="td-section">
        <h2 className="td-section-title">Tham số bản vẽ</h2>
        <div className="td-section-body">
          <div className="td-form-row">
            <label className="td-field">Tỷ lệ bản vẽ<select><option>1:500</option><option>1:1000</option><option>1:2000</option></select></label>
            <label className="td-field">Đơn vị<select><option>Mét</option><option>Milimét</option></select></label>
            <label className="td-field">Layer hiển thị<input type="text" defaultValue="HU_HONG_MD" /></label>
            <label className="td-field">Bề rộng đường (m)<input type="number" defaultValue={7} /></label>
          </div>
        </div>
      </section>

      <section className="td-section">
        <h2 className="td-section-title">Xuất bản vẽ</h2>
        <div className="td-section-body">
          <div className="td-action-row">
            <button type="button" className="btn btn-primary">🎨 Vẽ lên AutoCAD</button>
            <button type="button" className="btn btn-ghost">💾 Xuất file .dxf</button>
            <button type="button" className="btn btn-ghost">📋 Copy LISP script</button>
            <button type="button" className="btn btn-ghost">👁 Preview</button>
          </div>
          <p className="muted small" style={{ marginTop: 8 }}>
            Cần AutoCAD đang mở để &quot;Vẽ trực tiếp&quot;. Nếu không, tải DXF rồi import vào AutoCAD.
          </p>
        </div>
      </section>

      <footer className="td-panel-foot muted small">
        ⚠ Module demo — engine parse Excel + sinh DXF/LISP sẽ thêm ở phase sau.
      </footer>
    </div>
  );
}
