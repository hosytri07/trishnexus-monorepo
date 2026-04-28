/**
 * Phase 14.4.5 — TrishDesign · 9. Tiện ích GIS – MAP
 *
 * Map + AutoCAD · WGS84 ↔ VN2000 · GIS overview · quản lý mốc tọa độ.
 */

export function GISMapPanel(): JSX.Element {
  return (
    <div className="td-panel">
      <header className="td-panel-head">
        <h1>🌐 Tiện ích GIS – MAP</h1>
        <p className="td-lead">
          Tiện ích làm việc trên Map và AutoCAD — chuyển đổi tọa độ WGS84 ↔
          VN2000, quản lý hệ thống mốc tọa độ, overlay bản vẽ + import KML.
        </p>
      </header>

      <section className="td-section">
        <h2 className="td-section-title">Tổng quan GIS</h2>
        <div className="td-section-body">
          <div className="td-stat-grid">
            <div className="td-stat-card"><span className="td-stat-icon">📍</span><div><div className="td-stat-label">Mốc tọa độ đang quản lý</div><div className="td-stat-value">0</div></div></div>
            <div className="td-stat-card"><span className="td-stat-icon">🗺</span><div><div className="td-stat-label">Layer KML/KMZ</div><div className="td-stat-value">0</div></div></div>
            <div className="td-stat-card"><span className="td-stat-icon">📐</span><div><div className="td-stat-label">Bản vẽ CAD đã liên kết</div><div className="td-stat-value">0</div></div></div>
            <div className="td-stat-card"><span className="td-stat-icon">🌏</span><div><div className="td-stat-label">Khu vực dự án</div><div className="td-stat-value">—</div></div></div>
          </div>
        </div>
      </section>

      <section className="td-section">
        <h2 className="td-section-title">Chuyển đổi tọa độ</h2>
        <div className="td-section-body">
          <div className="td-form-row">
            <label className="td-field">Hệ nguồn<select><option>VN2000 (KTT 105°00&apos;)</option><option>VN2000 (KTT theo tỉnh)</option><option>WGS84 (lat/lng)</option><option>UTM Zone 48N / 49N</option></select></label>
            <label className="td-field">X / Lat<input type="text" /></label>
            <label className="td-field">Y / Lng<input type="text" /></label>
            <label className="td-field">Hệ đích<select><option>WGS84</option><option>VN2000</option><option>UTM</option></select></label>
          </div>
          <div className="td-action-row" style={{ marginTop: 12 }}>
            <button type="button" className="btn btn-primary">↔ Chuyển đổi</button>
            <button type="button" className="btn btn-ghost">📋 Convert hàng loạt từ Excel</button>
          </div>
        </div>
      </section>

      <section className="td-section">
        <h2 className="td-section-title">Quản lý mốc tọa độ</h2>
        <div className="td-section-body">
          <table className="td-mini-table">
            <thead><tr><th>Mã mốc</th><th>X</th><th>Y</th><th>Z (cao trình)</th><th>Loại mốc</th><th>Tình trạng</th></tr></thead>
            <tbody><tr><td colSpan={6} className="muted small" style={{ textAlign: 'center', padding: 16 }}>(Chưa có mốc nào)</td></tr></tbody>
          </table>
          <div className="td-action-row" style={{ marginTop: 8 }}>
            <button type="button" className="btn btn-ghost">＋ Thêm mốc</button>
            <button type="button" className="btn btn-ghost">📥 Import từ Excel</button>
            <button type="button" className="btn btn-ghost">📤 Export về Excel</button>
            <button type="button" className="btn btn-ghost">🗺 Overlay lên Map</button>
          </div>
        </div>
      </section>

      <section className="td-section">
        <h2 className="td-section-title">Map preview</h2>
        <div className="td-section-body">
          <div className="td-empty-card">
            <strong>🗺 (Map placeholder)</strong>
            <p className="muted small">
              Hiển thị map (Leaflet / OpenStreetMap) — overlay mốc + KML + đường
              đo. Có thể import KML/KMZ/GPX/Shapefile từ máy.
            </p>
          </div>
        </div>
      </section>

      <section className="td-section">
        <h2 className="td-section-title">Liên kết AutoCAD</h2>
        <div className="td-section-body">
          <div className="td-action-row">
            <button type="button" className="btn btn-ghost">🎨 Đẩy mốc sang CAD</button>
            <button type="button" className="btn btn-ghost">📐 Sync layer từ CAD</button>
            <button type="button" className="btn btn-ghost">🗺 Export tuyến KML</button>
          </div>
        </div>
      </section>

      <footer className="td-panel-foot muted small">
        ⚠ Module demo — engine chuyển hệ + map render sẽ thêm ở phase sau.
      </footer>
    </div>
  );
}
