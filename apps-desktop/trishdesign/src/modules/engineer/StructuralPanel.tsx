/**
 * Phase 14.4.5 — TrishDesign · 7. Bảng tính kết cấu
 *
 * Admin upload Excel → convert thành module tính nhanh.
 * Có dashboard tổng quan + export báo cáo + user đóng góp.
 */

export function StructuralPanel(): JSX.Element {
  return (
    <div className="td-panel">
      <header className="td-panel-head">
        <h1>🏗 Bảng tính kết cấu</h1>
        <p className="td-lead">
          Thư viện bảng tính Excel do Admin upload — convert thành module tính
          gọn nhẹ trong app. Dashboard tổng quan + export báo cáo + cho phép
          User đóng góp bảng tính mới gửi Admin duyệt.
        </p>
      </header>

      <section className="td-section">
        <h2 className="td-section-title">Tổng quan</h2>
        <div className="td-section-body">
          <div className="td-stat-grid">
            <div className="td-stat-card"><span className="td-stat-icon">📊</span><div><div className="td-stat-label">Bảng tính có sẵn</div><div className="td-stat-value">0</div></div></div>
            <div className="td-stat-card"><span className="td-stat-icon">⭐</span><div><div className="td-stat-label">Yêu thích</div><div className="td-stat-value">0</div></div></div>
            <div className="td-stat-card"><span className="td-stat-icon">📤</span><div><div className="td-stat-label">User đã đóng góp</div><div className="td-stat-value">0</div></div></div>
            <div className="td-stat-card"><span className="td-stat-icon">🕒</span><div><div className="td-stat-label">Tính lần cuối</div><div className="td-stat-value">—</div></div></div>
          </div>
        </div>
      </section>

      <section className="td-section">
        <h2 className="td-section-title">Module tính (do Admin upload)</h2>
        <div className="td-section-body">
          <div className="td-tile-grid">
            <div className="td-tile">📐 Dầm BTCT giản đơn</div>
            <div className="td-tile">📐 Dầm BTCT liên tục</div>
            <div className="td-tile">🔻 Móng đơn</div>
            <div className="td-tile">🔻 Móng băng</div>
            <div className="td-tile">🔻 Móng cọc</div>
            <div className="td-tile">🏛 Mố trụ cầu</div>
            <div className="td-tile">⬇ Cọc khoan nhồi</div>
            <div className="td-tile">⬛ Sàn 1 phương / 2 phương</div>
            <div className="td-tile">🧱 Tường chắn trọng lực</div>
            <div className="td-tile">⚙ Cống tròn / cống hộp</div>
          </div>
        </div>
      </section>

      <section className="td-section">
        <h2 className="td-section-title">Đóng góp của User</h2>
        <div className="td-section-body">
          <p className="muted small" style={{ marginBottom: 8 }}>
            Bạn có file Excel tính kết cấu hữu ích? Upload để Admin xem xét, nếu
            duyệt sẽ thành module dùng chung cho cộng đồng.
          </p>
          <div className="td-action-row">
            <button type="button" className="btn btn-primary">📤 Upload bảng tính</button>
            <button type="button" className="btn btn-ghost">📋 Xem trạng thái duyệt</button>
          </div>
        </div>
      </section>

      <section className="td-section">
        <h2 className="td-section-title">Hành động chung</h2>
        <div className="td-section-body">
          <div className="td-action-row">
            <button type="button" className="btn btn-ghost">📊 Mở module tính</button>
            <button type="button" className="btn btn-ghost">📄 Export báo cáo Word</button>
            <button type="button" className="btn btn-ghost">🕓 Lịch sử tính</button>
          </div>
        </div>
      </section>

      <footer className="td-panel-foot muted small">
        ⚠ Module demo — engine convert Excel + workflow Admin duyệt sẽ thêm ở phase sau.
      </footer>
    </div>
  );
}
