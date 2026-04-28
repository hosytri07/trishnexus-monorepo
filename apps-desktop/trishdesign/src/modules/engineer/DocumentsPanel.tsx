/**
 * Phase 14.4.5 — TrishDesign · 2. Danh mục hồ sơ
 *
 * Khảo sát / Thiết kế / Hoàn công / Nghiệm thu / Thẩm tra
 * Mẫu danh mục, biên bản, thuyết minh + auto-fill biến chung.
 */

export function DocumentsPanel(): JSX.Element {
  return (
    <div className="td-panel">
      <header className="td-panel-head">
        <h1>📂 Danh mục hồ sơ</h1>
        <p className="td-lead">
          Mẫu danh mục hồ sơ + biên bản + thuyết minh — cho từng giai đoạn dự án.
          Auto-fill biến chung (tên dự án / chủ đầu tư / đơn vị tư vấn) vào nhiều
          file một lần.
        </p>
      </header>

      <section className="td-section">
        <h2 className="td-section-title">Giai đoạn dự án</h2>
        <div className="td-section-body">
          <div className="td-tile-grid">
            <div className="td-tile">📋 Hồ sơ Khảo sát</div>
            <div className="td-tile">📐 Hồ sơ Thiết kế</div>
            <div className="td-tile">🏗 Hồ sơ Hoàn công</div>
            <div className="td-tile">✅ Hồ sơ Nghiệm thu</div>
            <div className="td-tile">🔍 Hồ sơ Thẩm tra</div>
          </div>
        </div>
      </section>

      <section className="td-section">
        <h2 className="td-section-title">Mẫu thuyết minh</h2>
        <div className="td-section-body">
          <div className="td-tile-grid">
            <div className="td-tile">📄 Thuyết minh thiết kế cơ sở</div>
            <div className="td-tile">📄 Thuyết minh BVTC</div>
            <div className="td-tile">📄 Thuyết minh khảo sát địa chất</div>
            <div className="td-tile">📄 Thuyết minh khảo sát thủy văn</div>
            <div className="td-tile">📄 Báo cáo kinh tế kỹ thuật</div>
            <div className="td-tile">📄 Báo cáo nghiên cứu khả thi</div>
          </div>
        </div>
      </section>

      <section className="td-section">
        <h2 className="td-section-title">Mẫu biên bản</h2>
        <div className="td-section-body">
          <div className="td-tile-grid">
            <div className="td-tile">📑 BB nghiệm thu công việc</div>
            <div className="td-tile">📑 BB nghiệm thu giai đoạn</div>
            <div className="td-tile">📑 BB nghiệm thu hoàn thành</div>
            <div className="td-tile">📑 BB bàn giao mặt bằng</div>
            <div className="td-tile">📑 BB hiện trường khảo sát</div>
            <div className="td-tile">📑 BB họp thẩm tra</div>
          </div>
        </div>
      </section>

      <section className="td-section">
        <h2 className="td-section-title">Mẫu danh mục + tờ trình</h2>
        <div className="td-section-body">
          <div className="td-tile-grid">
            <div className="td-tile">📊 Danh mục bản vẽ</div>
            <div className="td-tile">📊 Danh mục thiết bị</div>
            <div className="td-tile">📊 Danh mục vật liệu</div>
            <div className="td-tile">📋 Tờ trình thẩm định</div>
            <div className="td-tile">📋 Tờ trình phê duyệt</div>
            <div className="td-tile">📋 Quyết định phê duyệt</div>
          </div>
        </div>
      </section>

      <section className="td-section">
        <h2 className="td-section-title">Biến chung của dự án (auto-fill)</h2>
        <div className="td-section-body">
          <div className="td-form-row">
            <label className="td-field">Tên dự án<input type="text" /></label>
            <label className="td-field">Chủ đầu tư<input type="text" /></label>
            <label className="td-field">Đơn vị tư vấn<input type="text" /></label>
            <label className="td-field">Đơn vị thiết kế<input type="text" /></label>
            <label className="td-field">Năm thực hiện<input type="number" /></label>
            <label className="td-field">Mã dự án<input type="text" /></label>
          </div>
          <p className="muted small" style={{ marginTop: 8 }}>
            Biến này sẽ tự động chèn vào tất cả template Word/Excel khi Export.
          </p>
        </div>
      </section>

      <section className="td-section">
        <h2 className="td-section-title">Hành động</h2>
        <div className="td-section-body">
          <div className="td-action-row">
            <button type="button" className="btn btn-primary">📦 Export tất cả</button>
            <button type="button" className="btn btn-ghost">＋ Upload template mới</button>
            <button type="button" className="btn btn-ghost">⚙ Quản lý template</button>
          </div>
        </div>
      </section>

      <footer className="td-panel-foot muted small">
        ⚠ Module demo — engine merge + export Word sẽ thêm ở phase sau.
      </footer>
    </div>
  );
}
