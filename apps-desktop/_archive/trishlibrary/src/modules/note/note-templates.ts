/**
 * Phase 18.2.c — Note templates.
 *
 * Bộ template structured content cho các loại ghi chú thường dùng.
 * Mỗi template có id, icon, name, keywords (cho filter), description,
 * và html (nội dung TipTap-compatible).
 *
 * Placeholder `{{date}}` và `{{datetime}}` sẽ replace runtime.
 */

export interface NoteTemplate {
  id: string;
  icon: string;
  name: string;
  keywords: string[];
  description: string;
  category: 'work' | 'personal' | 'project';
  /** HTML body. Title của note sẽ tự setattle nếu template có suggestedTitle. */
  html: string;
  suggestedTitle?: string;
}

function dateStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function datetimeStr(): string {
  const d = new Date();
  const date = dateStr();
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `${date} ${time}`;
}

function weekdayVi(): string {
  const days = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
  return days[new Date().getDay()];
}

/** Replace template placeholders with current values. */
export function expandTemplate(template: NoteTemplate): { title: string; html: string } {
  const date = dateStr();
  const datetime = datetimeStr();
  const weekday = weekdayVi();
  const replace = (s: string): string =>
    s
      .replace(/\{\{date\}\}/g, date)
      .replace(/\{\{datetime\}\}/g, datetime)
      .replace(/\{\{weekday\}\}/g, weekday);
  return {
    title: replace(template.suggestedTitle ?? template.name),
    html: replace(template.html),
  };
}

export const NOTE_TEMPLATES: NoteTemplate[] = [
  {
    id: 'meeting',
    icon: '🗓',
    name: 'Cuộc họp',
    keywords: ['meeting', 'cuoc hop', 'họp'],
    description: 'Template biên bản họp với chương trình + quyết định + việc cần làm',
    category: 'work',
    suggestedTitle: 'Họp {{date}} — ',
    html: `<h2>🗓 Cuộc họp — {{date}}</h2>
<p><strong>Thời gian:</strong> {{datetime}}</p>
<p><strong>Địa điểm:</strong> </p>
<p><strong>Tham dự:</strong> </p>
<p><strong>Chủ trì:</strong> </p>
<h3>📋 Chương trình</h3>
<ol><li></li></ol>
<h3>💬 Thảo luận</h3>
<p></p>
<h3>⚖ Quyết định</h3>
<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div></div></li></ul>
<h3>📌 Việc cần làm</h3>
<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>(Ai? Hạn? Việc gì?)</p></div></li></ul>
<h3>📝 Ghi chú khác</h3>
<p></p>`,
  },
  {
    id: 'daily',
    icon: '📅',
    name: 'Daily journal',
    keywords: ['daily', 'journal', 'nhat ky', 'ngay'],
    description: 'Nhật ký ngày — mục tiêu, hoàn thành, suy nghĩ, biết ơn',
    category: 'personal',
    suggestedTitle: '{{date}}',
    html: `<h2>📅 {{date}} — {{weekday}}</h2>
<h3>🎯 Mục tiêu hôm nay (top 3)</h3>
<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div></div></li><li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div></div></li><li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div></div></li></ul>
<h3>✅ Đã hoàn thành</h3>
<ul><li></li></ul>
<h3>💭 Suy nghĩ / cảm xúc</h3>
<p></p>
<h3>📚 Học được gì</h3>
<ul><li></li></ul>
<h3>🎉 Biết ơn 3 điều</h3>
<ol><li></li><li></li><li></li></ol>`,
  },
  {
    id: 'kickoff',
    icon: '🚀',
    name: 'Project kickoff',
    keywords: ['project', 'kickoff', 'du an', 'khoi dong'],
    description: 'Khởi động dự án — mục tiêu, scope, milestones, team, risks',
    category: 'project',
    suggestedTitle: 'Kickoff: ',
    html: `<h2>🚀 Project Kickoff</h2>
<p><strong>Tên dự án:</strong> </p>
<p><strong>Ngày bắt đầu:</strong> {{date}}</p>
<p><strong>Deadline:</strong> </p>
<p><strong>Sponsor / chủ dự án:</strong> </p>
<h3>🎯 Mục tiêu (Goal)</h3>
<p>Mô tả 1-2 câu mục tiêu chính của dự án.</p>
<h3>📦 Scope</h3>
<p><strong>In-scope:</strong></p>
<ul><li></li></ul>
<p><strong>Out-of-scope:</strong></p>
<ul><li></li></ul>
<h3>📊 Success metrics</h3>
<ul><li>KPI 1: </li><li>KPI 2: </li></ul>
<h3>👥 Team</h3>
<table><tbody><tr><th>Vai trò</th><th>Người</th><th>Liên hệ</th></tr><tr><td>PM</td><td></td><td></td></tr><tr><td>Tech lead</td><td></td><td></td></tr></tbody></table>
<h3>🗓 Milestones</h3>
<ol><li>M1 — </li><li>M2 — </li><li>M3 — </li></ol>
<h3>⚠ Risks</h3>
<ul><li><strong>Rủi ro:</strong> ... <strong>Mitigation:</strong> ...</li></ul>
<h3>📝 Notes</h3>
<p></p>`,
  },
  {
    id: 'weekly',
    icon: '📊',
    name: 'Weekly review',
    keywords: ['weekly', 'review', 'tuan'],
    description: 'Review tuần — wins, struggles, learnings, kế hoạch tuần sau',
    category: 'personal',
    suggestedTitle: 'Weekly review {{date}}',
    html: `<h2>📊 Weekly review — tuần {{date}}</h2>
<h3>🏆 Thắng lợi (Wins)</h3>
<ul><li></li></ul>
<h3>😕 Khó khăn (Struggles)</h3>
<ul><li></li></ul>
<h3>📚 Học được</h3>
<ul><li></li></ul>
<h3>🎯 Kế hoạch tuần sau</h3>
<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div></div></li></ul>
<h3>📈 Số liệu / metrics</h3>
<ul><li></li></ul>
<h3>💭 Phản tư</h3>
<p></p>`,
  },
  {
    id: 'decision',
    icon: '⚖',
    name: 'Decision log',
    keywords: ['decision', 'quyet dinh', 'adr'],
    description: 'Ghi chép quyết định quan trọng — context, options, decision, consequences',
    category: 'work',
    suggestedTitle: 'Quyết định: ',
    html: `<h2>⚖ Quyết định — {{date}}</h2>
<p><strong>Người ra quyết định:</strong> </p>
<p><strong>Stakeholders:</strong> </p>
<p><strong>Trạng thái:</strong> 🟡 Đề xuất / 🟢 Đã quyết / 🔴 Đã bị thay thế</p>
<h3>📖 Bối cảnh (Context)</h3>
<p>Tại sao cần quyết định? Tình huống/vấn đề là gì?</p>
<h3>🔍 Các phương án</h3>
<ol><li><strong>Option A:</strong> Mô tả + ưu/nhược</li><li><strong>Option B:</strong> </li><li><strong>Option C:</strong> </li></ol>
<h3>✅ Quyết định</h3>
<p><strong>Chọn:</strong> </p>
<p><strong>Lý do:</strong> </p>
<h3>📍 Hệ quả (Consequences)</h3>
<ul><li><strong>Tích cực:</strong> </li><li><strong>Tiêu cực / chấp nhận:</strong> </li></ul>
<h3>🔗 Tham khảo</h3>
<ul><li></li></ul>`,
  },
  {
    id: 'brainstorm',
    icon: '💡',
    name: 'Brainstorm',
    keywords: ['brainstorm', 'idea', 'y tuong'],
    description: 'Phát ý tưởng tự do — không phán xét, sau đó nhóm + ưu tiên',
    category: 'personal',
    suggestedTitle: 'Brainstorm: ',
    html: `<h2>💡 Brainstorm — {{date}}</h2>
<p><strong>Vấn đề / câu hỏi:</strong> </p>
<h3>🌧 Đổ ý tưởng (không phán xét)</h3>
<ul><li></li><li></li><li></li><li></li><li></li></ul>
<h3>🎯 Top picks</h3>
<ol><li><strong>★</strong> </li><li><strong>★</strong> </li><li><strong>★</strong> </li></ol>
<h3>🧩 Liên kết / nhóm</h3>
<p></p>
<h3>➡ Bước tiếp theo</h3>
<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div></div></li></ul>`,
  },
  {
    id: 'todo',
    icon: '📋',
    name: 'Todo list',
    keywords: ['todo', 'task', 'viec', 'lam'],
    description: 'Danh sách công việc đơn giản với deadline',
    category: 'personal',
    suggestedTitle: 'Todo {{date}}',
    html: `<h2>📋 Todo {{date}}</h2>
<h3>🔥 Ưu tiên cao</h3>
<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div></div></li></ul>
<h3>🟡 Bình thường</h3>
<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div></div></li></ul>
<h3>🟢 Có thì tốt</h3>
<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div></div></li></ul>
<h3>📌 Đợi (Waiting on)</h3>
<ul><li></li></ul>`,
  },
  {
    id: 'okr',
    icon: '🎯',
    name: 'OKR / Goals',
    keywords: ['okr', 'goal', 'muc tieu'],
    description: 'Objectives + Key Results với progress tracking',
    category: 'work',
    suggestedTitle: 'OKR Q{{date}}',
    html: `<h2>🎯 OKR — {{date}}</h2>
<p><strong>Period:</strong> </p>
<p><strong>Owner:</strong> </p>
<h3>🏔 Objective 1</h3>
<p><strong>Mục tiêu:</strong> </p>
<p><strong>Why it matters:</strong> </p>
<h4>Key Results</h4>
<ul><li><strong>KR1.1:</strong>  — Progress: 0%</li><li><strong>KR1.2:</strong>  — Progress: 0%</li><li><strong>KR1.3:</strong>  — Progress: 0%</li></ul>
<h3>🏔 Objective 2</h3>
<p><strong>Mục tiêu:</strong> </p>
<h4>Key Results</h4>
<ul><li><strong>KR2.1:</strong>  — Progress: 0%</li><li><strong>KR2.2:</strong>  — Progress: 0%</li></ul>
<h3>📅 Check-in</h3>
<p>Tuần 1, 2, 4, 8 update progress + blockers.</p>`,
  },
  {
    id: 'one-on-one',
    icon: '📞',
    name: '1-on-1',
    keywords: ['1on1', 'one on one', '11', 'gap', 'meeting'],
    description: '1-on-1 meeting với manager/teammate — career, work, feedback',
    category: 'work',
    suggestedTitle: '1-on-1 với ',
    html: `<h2>📞 1-on-1 — {{date}}</h2>
<p><strong>Với:</strong> </p>
<p><strong>Tần suất:</strong> Hàng tuần / 2 tuần / tháng</p>
<h3>🟢 Tin tốt / wins</h3>
<ul><li></li></ul>
<h3>🚧 Blockers / khó khăn</h3>
<ul><li></li></ul>
<h3>💼 Việc đang làm</h3>
<p></p>
<h3>🎯 Career / phát triển</h3>
<ul><li>Mục tiêu ngắn hạn (1-3 tháng): </li><li>Mục tiêu dài hạn (6-12 tháng): </li></ul>
<h3>💬 Feedback</h3>
<p><strong>Cho tôi:</strong> </p>
<p><strong>Cho bạn:</strong> </p>
<h3>📌 Action items</h3>
<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div></div></li></ul>`,
  },
  {
    id: 'bug',
    icon: '🐛',
    name: 'Bug report',
    keywords: ['bug', 'issue', 'loi'],
    description: 'Báo cáo lỗi với steps to reproduce + expected/actual',
    category: 'work',
    suggestedTitle: 'BUG: ',
    html: `<h2>🐛 Bug report — {{date}}</h2>
<p><strong>Tiêu đề:</strong> </p>
<p><strong>Mức độ:</strong> 🔴 Critical / 🟠 High / 🟡 Medium / 🟢 Low</p>
<p><strong>Người báo:</strong> </p>
<p><strong>Phiên bản:</strong> </p>
<p><strong>Môi trường:</strong> Windows / macOS / Linux · Browser: </p>
<h3>📖 Mô tả</h3>
<p></p>
<h3>🔁 Các bước tái hiện</h3>
<ol><li>Mở ...</li><li>Bấm vào ...</li><li>Quan sát ...</li></ol>
<h3>✅ Mong đợi</h3>
<p>Đáng lẽ phải ...</p>
<h3>❌ Thực tế</h3>
<p>Nhưng lại ...</p>
<h3>📷 Screenshot / log</h3>
<p>(paste ảnh hoặc log ở đây)</p>
<h3>💭 Phân tích / root cause</h3>
<p></p>
<h3>🔧 Cách sửa</h3>
<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div></div></li></ul>`,
  },
];
