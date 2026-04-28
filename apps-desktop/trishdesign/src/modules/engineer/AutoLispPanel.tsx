/**
 * Phase 14.4.5 — TrishDesign · 6. Quản lý Autolisp
 *
 * Thư viện LISP + áp vĩnh viễn / 1 lần / sửa / export.
 */

export function AutoLispPanel(): JSX.Element {
  return (
    <div className="td-panel">
      <header className="td-panel-head">
        <h1>🧩 Quản lý Autolisp</h1>
        <p className="td-lead">
          Thư viện script LISP cho AutoCAD: phân loại, mô tả, áp lệnh vĩnh viễn
          (auto-load mỗi lần mở CAD) hoặc 1 lần. Chỉnh sửa code + export script
          mới sau khi tweak.
        </p>
      </header>

      <section className="td-section">
        <h2 className="td-section-title">Thư viện LISP</h2>
        <div className="td-section-body">
          <div className="td-tile-grid">
            <div className="td-tile">⚡ Vẽ taluy đường</div>
            <div className="td-tile">📐 Vẽ đường đồng mức</div>
            <div className="td-tile">🪜 Tạo lưới tọa độ</div>
            <div className="td-tile">📏 Đo cự ly hàng loạt</div>
            <div className="td-tile">🔁 Auto-numbering objects</div>
            <div className="td-tile">📊 Export thống kê đối tượng</div>
            <div className="td-tile">🎯 Snap đến cọc khoan</div>
            <div className="td-tile">🧹 Clean drawing (purge + audit)</div>
            <div className="td-tile">+ Upload .lsp mới…</div>
          </div>
        </div>
      </section>

      <section className="td-section">
        <h2 className="td-section-title">Hành động (chọn 1 lệnh ở trên)</h2>
        <div className="td-section-body">
          <div className="td-action-row">
            <button type="button" className="btn btn-primary">🔒 Áp vĩnh viễn (auto-load)</button>
            <button type="button" className="btn btn-ghost">⚡ Áp 1 lần (session này)</button>
            <button type="button" className="btn btn-ghost">✏ Chỉnh sửa code</button>
            <button type="button" className="btn btn-ghost">💾 Export .lsp</button>
            <button type="button" className="btn btn-ghost">📋 Copy code</button>
          </div>
        </div>
      </section>

      <section className="td-section">
        <h2 className="td-section-title">Editor LISP</h2>
        <div className="td-section-body">
          <textarea className="td-ocr-output" rows={10} placeholder=";; Chọn 1 lệnh trong thư viện ở trên để mở code\n;; Sau khi chỉnh sửa có thể Export thành script mới"></textarea>
          <p className="muted small" style={{ marginTop: 6 }}>
            Editor sẽ hỗ trợ syntax highlighting cho LISP + auto-format ở phase sau.
          </p>
        </div>
      </section>

      <section className="td-section">
        <h2 className="td-section-title">Cấu hình AutoCAD</h2>
        <div className="td-section-body">
          <div className="td-form-row">
            <label className="td-field">Đường dẫn AutoCAD<input type="text" placeholder="C:\\Program Files\\Autodesk\\AutoCAD 2024" /></label>
            <label className="td-field">Folder LSP load mặc định<input type="text" placeholder="%appdata%\\Autodesk\\..." /></label>
          </div>
        </div>
      </section>

      <footer className="td-panel-foot muted small">
        ⚠ Module demo — wire vào CAD acad.lsp + editor monaco sẽ thêm ở phase sau.
      </footer>
    </div>
  );
}
