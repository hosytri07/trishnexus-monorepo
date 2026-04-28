/**
 * Phase 17.6 v2 — Document templates.
 * HTML content cho file mới — TipTap setContent ngon.
 */

export interface Template {
  id: string;
  name: string;
  icon: string;
  description: string;
  html: string;
}

export const TEMPLATES: Template[] = [
  {
    id: 'blank',
    name: 'Trang trắng',
    icon: '📄',
    description: 'Bắt đầu từ trang trắng',
    html: '<p></p>',
  },
  {
    id: 'report',
    name: 'Báo cáo',
    icon: '📊',
    description: 'Báo cáo công việc / nghiên cứu / dự án',
    html: `<h1>Tiêu đề báo cáo</h1>
<p><em>Tác giả: …</em> · <em>Ngày: …</em></p>
<h2>1. Tóm tắt</h2>
<p>Nội dung tóm tắt 2-3 câu mô tả vấn đề chính, phương pháp, kết quả.</p>
<h2>2. Bối cảnh</h2>
<p>Mô tả bối cảnh và lý do thực hiện báo cáo này.</p>
<h2>3. Phương pháp</h2>
<p>Liệt kê phương pháp tiếp cận, dữ liệu, công cụ.</p>
<ul><li>Bước 1: …</li><li>Bước 2: …</li><li>Bước 3: …</li></ul>
<h2>4. Kết quả</h2>
<p>Trình bày kết quả với số liệu, biểu đồ, ví dụ.</p>
<h2>5. Kết luận &amp; Đề xuất</h2>
<p>Kết luận và các bước tiếp theo đề xuất.</p>
<hr>
<p><em>Phụ lục / Tài liệu tham khảo</em></p>`,
  },
  {
    id: 'letter',
    name: 'Thư công việc',
    icon: '✉️',
    description: 'Thư xin việc / phản hồi / công văn',
    html: `<p>Kính gửi: <strong>…</strong></p>
<p>Tôi tên là <strong>…</strong>, …</p>
<p>Mục đích viết thư này là …</p>
<p>Nội dung chính:</p>
<ul><li>…</li><li>…</li></ul>
<p>Tôi rất mong nhận được phản hồi của Quý Anh/Chị.</p>
<p>Trân trọng,<br><strong>[Tên người gửi]</strong><br>[Email] · [SĐT]</p>`,
  },
  {
    id: 'resume',
    name: 'CV / Resume',
    icon: '🎯',
    description: 'Sơ yếu lý lịch / CV ứng tuyển',
    html: `<h1>HỌ VÀ TÊN</h1>
<p><em>Email: …</em> · <em>SĐT: …</em> · <em>Địa chỉ: …</em></p>
<h2>Mục tiêu nghề nghiệp</h2>
<p>1-2 câu mô tả mục tiêu, vị trí mong muốn, mức độ cam kết.</p>
<h2>Kinh nghiệm làm việc</h2>
<p><strong>Vị trí — Công ty</strong> · <em>Tháng/Năm – nay</em></p>
<ul>
  <li>Mô tả trách nhiệm, dự án quan trọng</li>
  <li>Kết quả đo lường được (số liệu, % cải thiện)</li>
</ul>
<h2>Học vấn</h2>
<p><strong>Đại học/Trường</strong> · <em>Năm tốt nghiệp</em><br>Chuyên ngành: …</p>
<h2>Kỹ năng</h2>
<ul>
  <li><strong>Cứng:</strong> …</li>
  <li><strong>Mềm:</strong> …</li>
  <li><strong>Ngoại ngữ:</strong> …</li>
</ul>
<h2>Dự án nổi bật</h2>
<p><strong>Tên dự án</strong> — Mô tả ngắn vai trò và kết quả.</p>`,
  },
  {
    id: 'meeting',
    name: 'Biên bản họp',
    icon: '📋',
    description: 'Note họp với agenda + action items',
    html: `<h1>Biên bản họp</h1>
<p><strong>Thời gian:</strong> …<br>
<strong>Địa điểm:</strong> …<br>
<strong>Người tham dự:</strong> …<br>
<strong>Người ghi:</strong> …</p>
<h2>Nội dung</h2>
<h3>1. Agenda</h3>
<ol><li>…</li><li>…</li><li>…</li></ol>
<h3>2. Thảo luận</h3>
<p>Tóm tắt thảo luận chính của từng item.</p>
<h3>3. Quyết định</h3>
<ul><li>…</li><li>…</li></ul>
<h3>4. Action items</h3>
<ul data-type="taskList">
  <li data-type="taskItem" data-checked="false"><div><p>[Người] làm gì — deadline …</p></div></li>
  <li data-type="taskItem" data-checked="false"><div><p>[Người] làm gì — deadline …</p></div></li>
</ul>
<h3>5. Họp tiếp theo</h3>
<p>Thời gian: …</p>`,
  },
  {
    id: 'blog',
    name: 'Bài blog',
    icon: '✍️',
    description: 'Bài viết blog có cấu trúc',
    html: `<h1>Tiêu đề bài viết</h1>
<p><em>By [Tác giả] · [Ngày]</em></p>
<blockquote><p>Một câu trích dẫn / hook ngay đầu bài.</p></blockquote>
<h2>Mở bài</h2>
<p>Đặt vấn đề trong 1-2 đoạn — vì sao reader nên đọc bài này.</p>
<h2>Nội dung chính</h2>
<h3>Phần 1: …</h3>
<p>…</p>
<h3>Phần 2: …</h3>
<p>…</p>
<h2>Kết luận</h2>
<p>Tóm tắt 3 điểm chính + call to action.</p>
<hr>
<p><em>Tags: #…</em></p>`,
  },
  {
    id: 'readme',
    name: 'README dự án',
    icon: '📦',
    description: 'README markdown style cho repo / dự án',
    html: `<h1>Tên dự án</h1>
<p><em>Mô tả 1 dòng về dự án.</em></p>
<h2>✨ Tính năng</h2>
<ul><li>…</li><li>…</li><li>…</li></ul>
<h2>🚀 Cài đặt</h2>
<pre><code>git clone https://github.com/…
cd …
npm install
npm run dev</code></pre>
<h2>📖 Sử dụng</h2>
<pre><code>import { foo } from './lib';
foo('hello');</code></pre>
<h2>🛠 Stack</h2>
<ul><li>…</li><li>…</li></ul>
<h2>📝 Đóng góp</h2>
<p>PR welcome — please open issue trước khi gửi PR lớn.</p>
<h2>📄 License</h2>
<p>MIT</p>`,
  },
];

export function findTemplate(id: string): Template | null {
  return TEMPLATES.find((t) => t.id === id) ?? null;
}
