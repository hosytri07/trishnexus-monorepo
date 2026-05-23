/**
 * Phase 28.1 — TrishDesign · 1. Dashboard & Hồ sơ dự án.
 *
 * Đọc từ useDesignDb (Phase 28.1) → show stats thật từ state.
 */

import { useDesignDb } from '../../state.js';
import { autoSegmentName } from '../../types.js';

export function DashboardPanel(): JSX.Element {
  const { db, setActiveProject, createProject } = useDesignDb();

  const totalSegments = db.projects.reduce((sum, p) => sum + p.segments.length, 0);
  const totalPieces = db.projects.reduce(
    (sum, p) => sum + p.segments.reduce((s, seg) => s + seg.damagePieces.length, 0),
    0,
  );
  const totalDamageArea = db.projects.reduce(
    (sum, p) => sum + p.segments.reduce(
      (s, seg) => s + seg.damagePieces.reduce((a, m) => a + m.width * m.length, 0),
      0,
    ),
    0,
  );

  function handleCreate() {
    const name = window.prompt('Tên hồ sơ mới:', 'Hồ sơ khảo sát ' + new Date().toLocaleDateString('vi-VN'));
    if (name?.trim()) createProject({ name: name.trim() });
  }

  return (
    <div className="td-panel">
      <header className="td-panel-head">
        <h1>🏠 Dashboard & Hồ sơ dự án</h1>
        <p className="td-lead">
          Tổng quan các hồ sơ khảo sát hư hỏng mặt đường + truy cập nhanh module công cụ.
        </p>
      </header>

      <section className="td-section">
        <h2 className="td-section-title">Thống kê</h2>
        <div className="td-stat-grid">
          <div className="td-stat-card">
            <span className="td-stat-icon">📁</span>
            <div>
              <div className="td-stat-label">Hồ sơ</div>
              <div className="td-stat-value">{db.projects.length}</div>
            </div>
          </div>
          <div className="td-stat-card">
            <span className="td-stat-icon">🛣</span>
            <div>
              <div className="td-stat-label">Đoạn đường</div>
              <div className="td-stat-value">{totalSegments}</div>
            </div>
          </div>
          <div className="td-stat-card">
            <span className="td-stat-icon">🧩</span>
            <div>
              <div className="td-stat-label">Miếng hư hỏng</div>
              <div className="td-stat-value">{totalPieces}</div>
            </div>
          </div>
          <div className="td-stat-card">
            <span className="td-stat-icon">📐</span>
            <div>
              <div className="td-stat-label">Tổng diện tích (m²)</div>
              <div className="td-stat-value">{totalDamageArea.toFixed(0)}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="td-section">
        <h2 className="td-section-title">Hồ sơ gần đây</h2>
        {db.projects.length === 0 ? (
          <div className="td-empty-card">
            <strong>Chưa có hồ sơ nào</strong>
            <p className="muted small">
              Tạo hồ sơ đầu tiên để bắt đầu khảo sát hư hỏng mặt đường.
              Mỗi hồ sơ chứa nhiều đoạn đường + danh sách miếng hư hỏng.
            </p>
          </div>
        ) : (
          <div className="rd-segment-list">
            {db.projects
              .slice()
              .sort((a, b) => b.updatedAt - a.updatedAt)
              .slice(0, 6)
              .map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`rd-segment-item${db.activeProjectId === p.id ? ' rd-segment-active' : ''}`}
                  onClick={() => setActiveProject(p.id)}
                >
                  <strong>{p.name}</strong>
                  <span className="muted small">
                    {p.segments.length} đoạn · {p.segments.reduce((s, seg) => s + seg.damagePieces.length, 0)} miếng
                  </span>
                  {p.surveyDate && <span className="muted small">📅 {p.surveyDate}</span>}
                  {p.segments.length > 0 && (
                    <span className="muted small">
                      → {autoSegmentName(p.segments[0].startStation, p.segments[p.segments.length - 1].endStation)}
                    </span>
                  )}
                </button>
              ))}
          </div>
        )}
      </section>

      <section className="td-section">
        <h2 className="td-section-title">Hành động nhanh</h2>
        <div className="td-action-row">
          <button type="button" className="btn btn-primary" onClick={handleCreate}>
            ➕ Hồ sơ mới
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => alert('Import từ Excel — Phase sau.')}>
            📊 Import Excel
          </button>
        </div>
      </section>

      <footer className="td-panel-foot muted small">
        💡 Vào tab <strong>Hư hỏng mặt đường</strong> ở sidebar để bắt đầu khảo sát + vẽ AutoCAD.
      </footer>
    </div>
  );
}
