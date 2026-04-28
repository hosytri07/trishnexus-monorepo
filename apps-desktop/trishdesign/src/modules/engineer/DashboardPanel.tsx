/**
 * Phase 14.4.5 — TrishDesign · 1. Dashboard & Thư viện dự án
 */

export function DashboardPanel(): JSX.Element {
  return (
    <div className="td-panel">
      <header className="td-panel-head">
        <h1>🏠 Dashboard & Thư viện dự án</h1>
        <p className="td-lead">
          Tổng quan dự án + truy cập nhanh các module công cụ. Mỗi dự án có thư
          viện file, bảng tính, bản vẽ + dự toán riêng.
        </p>
      </header>

      <section className="td-section">
        <h2 className="td-section-title">Thống kê</h2>
        <div className="td-section-body">
          <div className="td-stat-grid">
            <div className="td-stat-card"><span className="td-stat-icon">📁</span><div><div className="td-stat-label">Dự án đang mở</div><div className="td-stat-value">0</div></div></div>
            <div className="td-stat-card"><span className="td-stat-icon">📊</span><div><div className="td-stat-label">Bảng tính đã dùng</div><div className="td-stat-value">0</div></div></div>
            <div className="td-stat-card"><span className="td-stat-icon">📐</span><div><div className="td-stat-label">Bản vẽ AutoCAD</div><div className="td-stat-value">0</div></div></div>
            <div className="td-stat-card"><span className="td-stat-icon">🕓</span><div><div className="td-stat-label">Cập nhật gần nhất</div><div className="td-stat-value">—</div></div></div>
          </div>
        </div>
      </section>

      <section className="td-section">
        <h2 className="td-section-title">Dự án gần đây</h2>
        <div className="td-section-body">
          <div className="td-empty-card">
            <strong>(Chưa có dự án)</strong>
            <p className="muted small">
              Tạo dự án mới để bắt đầu. Mỗi dự án sẽ có thư viện hồ sơ, bảng
              tính, bản vẽ, dự toán riêng — quản lý tách biệt giữa các dự án.
            </p>
          </div>
        </div>
      </section>

      <section className="td-section">
        <h2 className="td-section-title">Hành động nhanh</h2>
        <div className="td-section-body">
          <div className="td-action-row">
            <button type="button" className="btn btn-primary">➕ Dự án mới</button>
            <button type="button" className="btn btn-ghost">📂 Mở dự án</button>
            <button type="button" className="btn btn-ghost">📥 Import từ ZIP</button>
            <button type="button" className="btn btn-ghost">⭐ Đánh dấu yêu thích</button>
          </div>
        </div>
      </section>

      <footer className="td-panel-foot muted small">
        ⚠ Module demo — cơ chế lưu trữ + sync sẽ thêm ở phase sau.
      </footer>
    </div>
  );
}
