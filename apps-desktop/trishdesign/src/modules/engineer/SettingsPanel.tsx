/**
 * Phase 14.4.5 — TrishDesign · 11. Cài đặt
 */

export function SettingsPanel(): JSX.Element {
  return (
    <div className="td-panel">
      <header className="td-panel-head">
        <h1>⚙ Cài đặt</h1>
        <p className="td-lead">Tùy chỉnh giao diện, ngôn ngữ, đường dẫn lưu trữ + tích hợp với phần mềm ngoài.</p>
      </header>

      <section className="td-section">
        <h2 className="td-section-title">Giao diện</h2>
        <div className="td-section-body">
          <div className="td-form-row">
            <label className="td-field">Theme<select><option>Tự động (theo hệ thống)</option><option>Sáng</option><option>Tối</option></select></label>
            <label className="td-field">Ngôn ngữ<select><option>Tiếng Việt</option><option>English</option></select></label>
            <label className="td-field">Cỡ chữ<select><option>Nhỏ</option><option>Vừa (mặc định)</option><option>Lớn</option></select></label>
            <label className="td-field">Sidebar mặc định<select><option>Mở</option><option>Thu gọn</option></select></label>
          </div>
        </div>
      </section>

      <section className="td-section">
        <h2 className="td-section-title">Đường dẫn lưu trữ</h2>
        <div className="td-section-body">
          <div className="td-form-row">
            <label className="td-field">Thư mục dự án mặc định<input type="text" placeholder="C:\\Users\\...\\TrishDesign\\Projects" /></label>
            <label className="td-field">Thư mục template<input type="text" placeholder="..." /></label>
            <label className="td-field">Thư mục LSP<input type="text" placeholder="%appdata%\\Autodesk..." /></label>
          </div>
          <div className="td-action-row" style={{ marginTop: 8 }}>
            <button type="button" className="btn btn-ghost">📂 Mở thư mục data</button>
            <button type="button" className="btn btn-ghost">🔄 Reset về mặc định</button>
          </div>
        </div>
      </section>

      <section className="td-section">
        <h2 className="td-section-title">Tích hợp phần mềm</h2>
        <div className="td-section-body">
          <div className="td-form-row">
            <label className="td-field">Phiên bản AutoCAD<select><option>AutoCAD 2024</option><option>AutoCAD 2023</option><option>AutoCAD 2022</option><option>AutoCAD LT</option><option>BricsCAD</option><option>ZWCAD</option></select></label>
            <label className="td-field">Microsoft Office<select><option>Office 365</option><option>Office 2021</option><option>Office 2019</option><option>WPS / LibreOffice</option></select></label>
          </div>
        </div>
      </section>

      <section className="td-section">
        <h2 className="td-section-title">Tài khoản</h2>
        <div className="td-section-body">
          <p className="muted small">Đăng nhập để sync dự án, đóng góp bảng tính, nhận update thư viện LISP mới nhất.</p>
          <div className="td-action-row" style={{ marginTop: 8 }}>
            <button type="button" className="btn btn-primary">🔐 Đăng nhập</button>
            <button type="button" className="btn btn-ghost">📖 Xem điều khoản sử dụng</button>
          </div>
        </div>
      </section>

      <section className="td-section">
        <h2 className="td-section-title">Về ứng dụng</h2>
        <div className="td-section-body">
          <p className="muted small">
            <strong>TrishDesign</strong> v2.0.0-alpha — Bộ công cụ Khảo sát &amp; Thiết kế.<br />
            © 2026 TrishTEAM · <a href="https://trishteam.io.vn" target="_blank" rel="noreferrer">trishteam.io.vn</a>
          </p>
          <div className="td-action-row" style={{ marginTop: 8 }}>
            <button type="button" className="btn btn-ghost">🔄 Kiểm tra bản cập nhật</button>
            <button type="button" className="btn btn-ghost">📝 Changelog</button>
            <button type="button" className="btn btn-ghost">💬 Gửi feedback</button>
          </div>
        </div>
      </section>

      <footer className="td-panel-foot muted small">
        ⚠ Module demo — persistence settings + cập nhật wire sẽ thêm ở phase sau.
      </footer>
    </div>
  );
}
