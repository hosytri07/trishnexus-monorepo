/**
 * Phase 14.4.5 — TrishDesign · 10. Chatbot RAG (MCP AutoCAD)
 *
 * Dùng AI để vẽ trên AutoCAD qua MCP — hỏi đáp + sinh lệnh CAD tự động.
 */

export function ChatbotPanel(): JSX.Element {
  return (
    <div className="td-panel">
      <header className="td-panel-head">
        <h1>🤖 Chatbot RAG · MCP AutoCAD</h1>
        <p className="td-lead">
          Dùng AI để vẽ trên AutoCAD qua MCP (Model Context Protocol) — hỏi đáp
          tiêu chuẩn ngành + thư viện dự án + sinh lệnh CAD/LISP tự động từ
          ngôn ngữ tự nhiên.
        </p>
      </header>

      <section className="td-section">
        <h2 className="td-section-title">Trạng thái kết nối</h2>
        <div className="td-section-body">
          <div className="td-stat-grid">
            <div className="td-stat-card"><span className="td-stat-icon">🤖</span><div><div className="td-stat-label">AI Engine</div><div className="td-stat-value">Chưa kết nối</div></div></div>
            <div className="td-stat-card"><span className="td-stat-icon">📐</span><div><div className="td-stat-label">AutoCAD MCP</div><div className="td-stat-value">Chưa kết nối</div></div></div>
            <div className="td-stat-card"><span className="td-stat-icon">📚</span><div><div className="td-stat-label">Indexed docs</div><div className="td-stat-value">0</div></div></div>
          </div>
        </div>
      </section>

      <section className="td-section">
        <h2 className="td-section-title">Cuộc trò chuyện</h2>
        <div className="td-section-body">
          <div className="td-chat-area">
            <div className="td-chat-msg td-chat-bot">👋 Chào bạn. Tôi giúp:<br />· Vẽ trên CAD bằng câu lệnh tự nhiên (vd: &quot;vẽ taluy 1:1.5 dài 50m từ cọc K0+100&quot;)<br />· Tra cứu tiêu chuẩn xây dựng<br />· Hỏi đáp trên thư viện dự án (RAG offline)</div>
          </div>
          <div className="td-chat-input">
            <input type="text" placeholder="Vd: Vẽ tuyến cong R=200, dài 80m từ cọc K1+200" />
            <button type="button" className="btn btn-primary">Gửi</button>
          </div>
        </div>
      </section>

      <section className="td-section">
        <h2 className="td-section-title">Nguồn tham khảo</h2>
        <div className="td-section-body">
          <label className="td-check"><input type="checkbox" defaultChecked /> 📁 Thư viện dự án hiện tại</label>
          <label className="td-check"><input type="checkbox" defaultChecked /> 📜 TCVN xây dựng (đã index)</label>
          <label className="td-check"><input type="checkbox" /> 📐 AutoCAD docs (qua MCP)</label>
          <label className="td-check"><input type="checkbox" /> 🌐 Web (cần online)</label>
        </div>
      </section>

      <section className="td-section">
        <h2 className="td-section-title">Cấu hình AI</h2>
        <div className="td-section-body">
          <div className="td-form-row">
            <label className="td-field">Model<select><option>Local — Llama 3.1 8B</option><option>Local — Qwen 2.5</option><option>Cloud — Claude 3.7</option><option>Cloud — GPT-4.1</option></select></label>
            <label className="td-field">Endpoint<input type="text" placeholder="http://localhost:11434 hoặc API key" /></label>
            <label className="td-field">Auto-execute lệnh CAD<select><option>Hỏi xác nhận từng lệnh</option><option>Auto chạy</option></select></label>
          </div>
        </div>
      </section>

      <footer className="td-panel-foot muted small">
        ⚠ Module demo — wire RAG + MCP AutoCAD sẽ thêm ở phase sau.
      </footer>
    </div>
  );
}
