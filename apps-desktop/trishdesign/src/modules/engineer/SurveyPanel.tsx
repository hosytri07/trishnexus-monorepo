/**
 * Phase 14.4.5 — TrishDesign · 5. Khảo sát
 *
 * Đưa hình ảnh / PDF sổ hiện trạng → AI đọc tự động → xuất Excel thống kê.
 */

export function SurveyPanel(): JSX.Element {
  return (
    <div className="td-panel">
      <header className="td-panel-head">
        <h1>🔍 Khảo sát</h1>
        <p className="td-lead">
          Upload ảnh chụp / PDF sổ hiện trạng → AI tự động OCR + nhận diện bảng
          → xuất Excel thống kê. Hỗ trợ tiếng Việt + chữ viết tay phổ biến.
        </p>
      </header>

      <section className="td-section">
        <h2 className="td-section-title">Upload tài liệu khảo sát</h2>
        <div className="td-section-body">
          <div className="td-upload-zone">
            <span className="td-upload-icon">📎</span>
            <p>Kéo thả ảnh / PDF vào đây — hoặc bấm chọn file</p>
            <p className="muted small">JPG, PNG, HEIC, PDF — tối đa 100 MB · batch upload nhiều file</p>
            <button type="button" className="btn btn-primary" style={{ marginTop: 12 }}>📂 Chọn file</button>
          </div>
        </div>
      </section>

      <section className="td-section">
        <h2 className="td-section-title">Loại sổ hiện trạng</h2>
        <div className="td-section-body">
          <div className="td-tile-grid">
            <div className="td-tile">📓 Sổ khảo sát địa chất</div>
            <div className="td-tile">📓 Sổ khảo sát thủy văn</div>
            <div className="td-tile">📓 Sổ đo cao trình</div>
            <div className="td-tile">📓 Sổ trắc dọc / trắc ngang</div>
            <div className="td-tile">📓 Sổ kiểm đếm GPMB</div>
            <div className="td-tile">📓 Sổ ghi chép hiện trường (tự do)</div>
          </div>
        </div>
      </section>

      <section className="td-section">
        <h2 className="td-section-title">Tùy chọn AI</h2>
        <div className="td-section-body">
          <label className="td-check"><input type="checkbox" defaultChecked /> Auto detect bảng + cấu trúc cột</label>
          <label className="td-check"><input type="checkbox" defaultChecked /> Nhận diện chữ viết tay tiếng Việt</label>
          <label className="td-check"><input type="checkbox" /> Cho phép tôi crop vùng quét</label>
          <label className="td-check"><input type="checkbox" defaultChecked /> Chuẩn hóa số (đơn vị + dấu thập phân)</label>
        </div>
      </section>

      <section className="td-section">
        <h2 className="td-section-title">Kết quả Excel</h2>
        <div className="td-section-body">
          <div className="td-empty-card">
            <strong>(Chưa có file nào được xử lý)</strong>
            <p className="muted small">
              Sau khi quét xong, kết quả Excel sẽ hiện ở đây — preview bảng + nút download.
            </p>
          </div>
        </div>
      </section>

      <footer className="td-panel-foot muted small">
        ⚠ Module demo — engine OCR + table extraction sẽ thêm ở phase sau.
      </footer>
    </div>
  );
}
