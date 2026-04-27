/**
 * Phase 18.7 — Document templates (TipTap HTML).
 * 22 templates đa dạng cho công việc, học tập, sáng tạo.
 */

export type TemplateCategory =
  | 'general'
  | 'business'
  | 'academic'
  | 'creative'
  | 'personal';

export interface Template {
  id: string;
  name: string;
  icon: string;
  category: TemplateCategory;
  description: string;
  html: string;
}

export const TEMPLATE_CATEGORIES: Record<TemplateCategory, string> = {
  general: 'Chung',
  business: 'Công việc',
  academic: 'Học thuật',
  creative: 'Sáng tạo',
  personal: 'Cá nhân',
};

export const TEMPLATES: Template[] = [
  // ============================================================
  // General
  // ============================================================
  {
    id: 'blank',
    name: 'Trang trắng',
    icon: '📄',
    category: 'general',
    description: 'Bắt đầu từ trang trắng',
    html: '<p></p>',
  },
  {
    id: 'meeting',
    name: 'Biên bản họp',
    icon: '📋',
    category: 'general',
    description: 'Note họp với agenda + action items',
    html: `<h1>Biên bản họp</h1>
<p><strong>Thời gian:</strong> …<br>
<strong>Địa điểm:</strong> …<br>
<strong>Người tham dự:</strong> …<br>
<strong>Người ghi:</strong> …</p>
<h2>Agenda</h2>
<ol><li>…</li><li>…</li><li>…</li></ol>
<h2>Thảo luận</h2>
<p>Tóm tắt thảo luận chính của từng item.</p>
<h2>Quyết định</h2>
<ul><li>…</li><li>…</li></ul>
<h2>Action items</h2>
<ul data-type="taskList">
<li data-type="taskItem" data-checked="false"><div><p>[Người] làm gì — deadline …</p></div></li>
<li data-type="taskItem" data-checked="false"><div><p>[Người] làm gì — deadline …</p></div></li>
</ul>
<h2>Họp tiếp theo</h2>
<p>Thời gian: …</p>`,
  },

  // ============================================================
  // Business
  // ============================================================
  {
    id: 'report',
    name: 'Báo cáo',
    icon: '📊',
    category: 'business',
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
<p>Kết luận và các bước tiếp theo đề xuất.</p>`,
  },
  {
    id: 'letter',
    name: 'Thư công việc',
    icon: '✉️',
    category: 'business',
    description: 'Thư phản hồi / công văn / thư cảm ơn',
    html: `<p>Kính gửi: <strong>…</strong></p>
<p>Tôi tên là <strong>…</strong>, …</p>
<p>Mục đích viết thư này là …</p>
<p>Nội dung chính:</p>
<ul><li>…</li><li>…</li></ul>
<p>Tôi rất mong nhận được phản hồi.</p>
<p>Trân trọng,<br><strong>[Tên người gửi]</strong></p>`,
  },
  {
    id: 'cover-letter',
    name: 'Thư xin việc',
    icon: '💼',
    category: 'business',
    description: 'Cover letter ứng tuyển vị trí',
    html: `<p><em>[Tên bạn] · [Email] · [SĐT]</em></p>
<p><em>Ngày: …</em></p>
<p>Kính gửi <strong>[Tên HR / Hiring Manager]</strong>,</p>
<p>Tôi viết thư này để bày tỏ sự quan tâm đến vị trí <strong>[Vị trí ứng tuyển]</strong> tại <strong>[Tên công ty]</strong>, được biết đến qua <strong>[nguồn tin tuyển dụng]</strong>.</p>
<h2>Tại sao tôi phù hợp</h2>
<ul>
  <li><strong>Kinh nghiệm:</strong> [Mô tả 2-3 năm kinh nghiệm liên quan]</li>
  <li><strong>Kỹ năng:</strong> [Liệt kê kỹ năng then chốt]</li>
  <li><strong>Thành tích:</strong> [Đo lường được — vd "Tăng doanh thu 30%"]</li>
</ul>
<h2>Tại sao tôi muốn làm việc tại [Công ty]</h2>
<p>[1-2 câu về văn hóa, sản phẩm, sứ mệnh công ty hấp dẫn bạn]</p>
<p>Tôi rất mong được trao đổi thêm trong buổi phỏng vấn. Cảm ơn anh/chị đã dành thời gian xem xét hồ sơ.</p>
<p>Trân trọng,<br><strong>[Tên bạn]</strong></p>`,
  },
  {
    id: 'resume',
    name: 'CV / Resume',
    icon: '🎯',
    category: 'business',
    description: 'Sơ yếu lý lịch ứng tuyển',
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
    id: 'invoice',
    name: 'Hóa đơn',
    icon: '🧾',
    category: 'business',
    description: 'Invoice cho khách hàng',
    html: `<h1 style="text-align:right">HÓA ĐƠN</h1>
<p style="text-align:right"><strong>Số: INV-…</strong><br>Ngày: …<br>Hạn thanh toán: …</p>
<hr>
<h3>Người gửi</h3>
<p><strong>[Tên công ty / cá nhân]</strong><br>[Địa chỉ]<br>[Email] · [SĐT] · [MST]</p>
<h3>Người nhận</h3>
<p><strong>[Tên khách hàng]</strong><br>[Địa chỉ]<br>[Email] · [SĐT]</p>
<h3>Chi tiết</h3>
<table>
  <thead>
    <tr><th>STT</th><th>Mô tả</th><th>SL</th><th>Đơn giá</th><th>Thành tiền</th></tr>
  </thead>
  <tbody>
    <tr><td>1</td><td>Dịch vụ A</td><td>1</td><td>1,000,000</td><td>1,000,000</td></tr>
    <tr><td>2</td><td>Sản phẩm B</td><td>2</td><td>500,000</td><td>1,000,000</td></tr>
  </tbody>
</table>
<p style="text-align:right"><strong>Tổng tạm tính:</strong> 2,000,000 đ<br>
<strong>VAT (10%):</strong> 200,000 đ<br>
<strong>TỔNG CỘNG:</strong> 2,200,000 đ</p>
<h3>Phương thức thanh toán</h3>
<p>Chuyển khoản ngân hàng:<br>
<strong>Tên TK:</strong> …<br>
<strong>Số TK:</strong> …<br>
<strong>Ngân hàng:</strong> …</p>
<p><em>Cảm ơn quý khách!</em></p>`,
  },
  {
    id: 'contract',
    name: 'Hợp đồng',
    icon: '📜',
    category: 'business',
    description: 'Mẫu hợp đồng dịch vụ / lao động',
    html: `<h1 style="text-align:center">HỢP ĐỒNG [LOẠI HỢP ĐỒNG]</h1>
<p style="text-align:center"><strong>Số: …/HĐ</strong></p>
<p><strong>Bên A:</strong> [Tên / Công ty]<br>Địa chỉ: …<br>Đại diện: … · Chức vụ: …<br>MST: …</p>
<p><strong>Bên B:</strong> [Tên / Công ty]<br>Địa chỉ: …<br>Đại diện: … · Chức vụ: …</p>
<p>Hai bên thống nhất ký kết hợp đồng với các điều khoản sau:</p>
<h2>Điều 1. Phạm vi</h2>
<p>Bên A đồng ý … và Bên B đồng ý …</p>
<h2>Điều 2. Giá trị hợp đồng</h2>
<p>Tổng giá trị: <strong>… VND</strong> (Bằng chữ: …)</p>
<h2>Điều 3. Thời hạn</h2>
<p>Hợp đồng có hiệu lực từ ngày … đến ngày …</p>
<h2>Điều 4. Quyền và nghĩa vụ của Bên A</h2>
<ul><li>…</li><li>…</li></ul>
<h2>Điều 5. Quyền và nghĩa vụ của Bên B</h2>
<ul><li>…</li><li>…</li></ul>
<h2>Điều 6. Điều khoản chung</h2>
<p>Mọi tranh chấp được giải quyết trên tinh thần hợp tác, nếu không thỏa thuận được sẽ đưa ra tòa án có thẩm quyền.</p>
<p>Hợp đồng được lập thành 2 bản, mỗi bên giữ 1 bản có giá trị pháp lý như nhau.</p>
<table>
  <tr>
    <td style="text-align:center"><strong>BÊN A</strong><br><br><br>(Ký, ghi rõ họ tên, đóng dấu)</td>
    <td style="text-align:center"><strong>BÊN B</strong><br><br><br>(Ký, ghi rõ họ tên, đóng dấu)</td>
  </tr>
</table>`,
  },
  {
    id: 'business-proposal',
    name: 'Đề xuất kinh doanh',
    icon: '💡',
    category: 'business',
    description: 'Business proposal / pitch văn bản',
    html: `<h1>Đề xuất [Tên dự án / sản phẩm]</h1>
<p><em>Người đề xuất: … · Ngày: …</em></p>
<h2>1. Tóm tắt điều hành (Executive Summary)</h2>
<p>3-5 câu nêu rõ vấn đề, giải pháp, giá trị mang lại, ngân sách đề xuất.</p>
<h2>2. Vấn đề / Cơ hội</h2>
<p>Phân tích vấn đề hiện tại và cơ hội thị trường.</p>
<h2>3. Giải pháp đề xuất</h2>
<p>Mô tả chi tiết giải pháp, sản phẩm/dịch vụ.</p>
<h2>4. Lợi ích</h2>
<ul>
  <li><strong>Doanh thu:</strong> …</li>
  <li><strong>Tiết kiệm chi phí:</strong> …</li>
  <li><strong>Hiệu quả vận hành:</strong> …</li>
</ul>
<h2>5. Kế hoạch triển khai</h2>
<p>Timeline + milestones.</p>
<h2>6. Ngân sách</h2>
<p>Chi tiết ngân sách đề xuất.</p>
<h2>7. Đội ngũ</h2>
<p>Giới thiệu team thực hiện.</p>
<h2>8. Bước tiếp theo</h2>
<p>Call to action — phê duyệt / họp / ký kết.</p>`,
  },
  {
    id: 'project-plan',
    name: 'Kế hoạch dự án',
    icon: '🗓',
    category: 'business',
    description: 'Project plan với timeline + tasks',
    html: `<h1>Kế hoạch dự án: [Tên]</h1>
<p><strong>Project Manager:</strong> …<br><strong>Bắt đầu:</strong> … <strong>Kết thúc:</strong> …</p>
<h2>Mục tiêu (Goals)</h2>
<ul><li>…</li><li>…</li></ul>
<h2>Phạm vi (Scope)</h2>
<p><strong>In scope:</strong> …</p>
<p><strong>Out of scope:</strong> …</p>
<h2>Stakeholders</h2>
<table>
  <thead><tr><th>Tên</th><th>Vai trò</th><th>Trách nhiệm</th></tr></thead>
  <tbody>
    <tr><td>…</td><td>Sponsor</td><td>Phê duyệt ngân sách</td></tr>
    <tr><td>…</td><td>PM</td><td>Quản lý dự án</td></tr>
    <tr><td>…</td><td>Dev</td><td>Triển khai</td></tr>
  </tbody>
</table>
<h2>Milestones</h2>
<ul data-type="taskList">
  <li data-type="taskItem" data-checked="false"><div><p><strong>Phase 1:</strong> Discovery — deadline …</p></div></li>
  <li data-type="taskItem" data-checked="false"><div><p><strong>Phase 2:</strong> Build — deadline …</p></div></li>
  <li data-type="taskItem" data-checked="false"><div><p><strong>Phase 3:</strong> Launch — deadline …</p></div></li>
</ul>
<h2>Risks</h2>
<table>
  <thead><tr><th>Risk</th><th>Khả năng</th><th>Tác động</th><th>Phản ứng</th></tr></thead>
  <tbody>
    <tr><td>…</td><td>Cao/TB/Thấp</td><td>Cao/TB/Thấp</td><td>…</td></tr>
  </tbody>
</table>
<h2>Communication Plan</h2>
<ul><li>Daily standup: …</li><li>Weekly sync: …</li><li>Monthly review: …</li></ul>`,
  },
  {
    id: 'press-release',
    name: 'Thông cáo báo chí',
    icon: '📢',
    category: 'business',
    description: 'Press release thông báo sản phẩm / sự kiện',
    html: `<p style="text-align:center"><strong>THÔNG CÁO BÁO CHÍ</strong></p>
<p style="text-align:center"><em>Để phát hành ngay</em></p>
<h1>[Tiêu đề thông cáo — ngắn gọn, gây chú ý]</h1>
<p><em>[Sub-headline — 1 câu mở rộng, làm rõ tiêu đề]</em></p>
<p><strong>[THÀNH PHỐ, NGÀY]</strong> — [Đoạn mở đầu trả lời 5W: Ai, làm gì, ở đâu, khi nào, vì sao. 2-3 câu.]</p>
<p>[Đoạn 2: Trích dẫn từ CEO/đại diện công ty. <em>"Chúng tôi rất tự hào…"</em> — [Tên + chức vụ].]</p>
<h2>Điểm nổi bật</h2>
<ul>
  <li>…</li>
  <li>…</li>
  <li>…</li>
</ul>
<p>[Đoạn 4: Background về công ty. 2-3 câu giới thiệu.]</p>
<h3>Thông tin liên hệ báo chí</h3>
<p><strong>Tên:</strong> …<br>
<strong>Email:</strong> …<br>
<strong>SĐT:</strong> …<br>
<strong>Website:</strong> …</p>
<p style="text-align:center">###</p>`,
  },
  {
    id: 'newsletter',
    name: 'Bản tin',
    icon: '📰',
    category: 'business',
    description: 'Newsletter định kỳ cho team / khách hàng',
    html: `<h1>[Tên bản tin] · Số [N] · [Tháng/Năm]</h1>
<blockquote><p>Tóm tắt 1-2 câu nội dung số này.</p></blockquote>
<h2>📰 Tin chính trong tháng</h2>
<ul>
  <li><strong>Tin 1:</strong> …</li>
  <li><strong>Tin 2:</strong> …</li>
</ul>
<h2>🎉 Highlights / Thành tích</h2>
<p>Nội dung kỷ niệm, milestone đạt được, member of the month, etc.</p>
<h2>📅 Sắp tới</h2>
<ul>
  <li>[Sự kiện 1] — Ngày …</li>
  <li>[Sự kiện 2] — Ngày …</li>
</ul>
<h2>💡 Tips / Tutorial</h2>
<p>Chia sẻ kiến thức / hướng dẫn ngắn cho reader.</p>
<h2>👥 Tin nội bộ / Welcome</h2>
<p>Chào đón thành viên mới, đội ngũ thay đổi.</p>
<hr>
<p><em>Câu hỏi / phản hồi? Gửi cho chúng tôi qua [email]. Hẹn gặp lại tháng sau!</em></p>`,
  },
  {
    id: 'user-manual',
    name: 'Hướng dẫn sử dụng',
    icon: '📖',
    category: 'business',
    description: 'User manual cho sản phẩm / phần mềm',
    html: `<h1>[Tên sản phẩm] — Hướng dẫn sử dụng</h1>
<p><em>Phiên bản: … · Cập nhật: …</em></p>
<h2>1. Giới thiệu</h2>
<p>Mô tả ngắn gọn sản phẩm / phần mềm.</p>
<h2>2. Yêu cầu hệ thống</h2>
<ul>
  <li>HĐH: Windows 10+ / macOS 10.15+ / Ubuntu 20+</li>
  <li>RAM: tối thiểu 4 GB</li>
  <li>Disk: 500 MB trống</li>
</ul>
<h2>3. Cài đặt</h2>
<ol>
  <li>Tải installer từ [link]</li>
  <li>Chạy file .exe / .msi</li>
  <li>Theo hướng dẫn wizard</li>
  <li>Khởi động ứng dụng</li>
</ol>
<h2>4. Bắt đầu nhanh</h2>
<p>3-5 bước để user làm việc đầu tiên thành công.</p>
<h2>5. Tính năng</h2>
<h3>5.1. [Tính năng A]</h3>
<p>Mô tả + screenshot + cách dùng.</p>
<h3>5.2. [Tính năng B]</h3>
<p>…</p>
<h2>6. Troubleshooting</h2>
<table>
  <thead><tr><th>Vấn đề</th><th>Nguyên nhân</th><th>Cách fix</th></tr></thead>
  <tbody>
    <tr><td>App không mở</td><td>Thiếu .NET 6+</td><td>Install .NET 6 từ Microsoft</td></tr>
  </tbody>
</table>
<h2>7. FAQ</h2>
<p><strong>Q:</strong> …<br><strong>A:</strong> …</p>
<h2>8. Liên hệ hỗ trợ</h2>
<p>Email: … · Hotline: … · Web: …</p>`,
  },

  // ============================================================
  // Academic
  // ============================================================
  {
    id: 'research-paper',
    name: 'Bài nghiên cứu',
    icon: '🔬',
    category: 'academic',
    description: 'Research paper format APA/IEEE',
    html: `<h1 style="text-align:center">[Tiêu đề bài nghiên cứu]</h1>
<p style="text-align:center"><strong>[Tác giả 1]<sup>1</sup>, [Tác giả 2]<sup>2</sup></strong></p>
<p style="text-align:center"><em><sup>1</sup>[Đơn vị] · <sup>2</sup>[Đơn vị]<br>Email: …</em></p>
<h2>Tóm tắt (Abstract)</h2>
<p><em>150-250 từ tóm tắt: bối cảnh, mục tiêu, phương pháp, kết quả, ý nghĩa.</em></p>
<p><strong>Từ khóa:</strong> keyword1, keyword2, keyword3, keyword4, keyword5</p>
<h2>1. Giới thiệu (Introduction)</h2>
<p>Đặt vấn đề, literature review, gap nghiên cứu, mục tiêu của bài.</p>
<h2>2. Cơ sở lý thuyết / Tài liệu liên quan (Related Work)</h2>
<p>Tổng hợp công trình liên quan đã có.</p>
<h2>3. Phương pháp (Methodology)</h2>
<p>Mô tả thiết kế nghiên cứu, dữ liệu, công cụ, quy trình.</p>
<h2>4. Kết quả (Results)</h2>
<p>Trình bày kết quả với bảng + biểu đồ + số liệu thống kê.</p>
<h2>5. Thảo luận (Discussion)</h2>
<p>Giải thích kết quả, so sánh với nghiên cứu trước, hạn chế.</p>
<h2>6. Kết luận (Conclusion)</h2>
<p>Tóm tắt đóng góp + hướng nghiên cứu tiếp theo.</p>
<h2>Tài liệu tham khảo (References)</h2>
<ol>
  <li>[Tác giả] (Năm). <em>Tên bài</em>. Tạp chí, vol(số), trang. doi:…</li>
  <li>…</li>
</ol>`,
  },
  {
    id: 'lesson-plan',
    name: 'Giáo án',
    icon: '🎓',
    category: 'academic',
    description: 'Lesson plan giảng dạy',
    html: `<h1>Giáo án — [Tên bài học]</h1>
<p><strong>Môn:</strong> … · <strong>Khối/Lớp:</strong> … · <strong>Thời lượng:</strong> … phút<br>
<strong>Giáo viên:</strong> … · <strong>Ngày:</strong> …</p>
<h2>I. Mục tiêu bài học</h2>
<p>Sau bài học, học sinh có thể:</p>
<ol>
  <li><strong>Kiến thức:</strong> Hiểu được … / phân tích được …</li>
  <li><strong>Kỹ năng:</strong> Áp dụng … vào …</li>
  <li><strong>Thái độ:</strong> Yêu thích / hứng thú với …</li>
</ol>
<h2>II. Chuẩn bị</h2>
<ul>
  <li><strong>Giáo viên:</strong> Slide, bảng, video minh hoạ</li>
  <li><strong>Học sinh:</strong> Vở, SGK, máy tính (nếu cần)</li>
</ul>
<h2>III. Tiến trình bài học</h2>
<table>
  <thead><tr><th>TG</th><th>Hoạt động GV</th><th>Hoạt động HS</th><th>PP</th></tr></thead>
  <tbody>
    <tr><td>5'</td><td>Mở bài: hỏi câu gợi mở</td><td>Trả lời, dự đoán</td><td>Đàm thoại</td></tr>
    <tr><td>15'</td><td>Giảng nội dung 1</td><td>Lắng nghe, ghi chú</td><td>Diễn giảng + slide</td></tr>
    <tr><td>10'</td><td>Bài tập áp dụng</td><td>Làm theo nhóm 4</td><td>Thảo luận nhóm</td></tr>
    <tr><td>10'</td><td>Tổng kết</td><td>Trình bày, hỏi đáp</td><td>Vấn đáp</td></tr>
    <tr><td>5'</td><td>Giao bài về nhà</td><td>Ghi nhận</td><td>—</td></tr>
  </tbody>
</table>
<h2>IV. Đánh giá</h2>
<p>Quan sát hoạt động + chấm bài cá nhân + bài kiểm tra cuối tuần.</p>
<h2>V. Bài tập về nhà</h2>
<ul>
  <li>SGK trang … bài …</li>
  <li>Đọc trước bài tiếp theo</li>
</ul>`,
  },

  // ============================================================
  // Creative
  // ============================================================
  {
    id: 'blog',
    name: 'Bài blog',
    icon: '✍️',
    category: 'creative',
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
    id: 'article',
    name: 'Bài báo',
    icon: '📑',
    category: 'creative',
    description: 'Article style — phân tích / phóng sự',
    html: `<h1>[Tiêu đề lôi cuốn — số liệu / câu hỏi / ngược chiều]</h1>
<p><em>[Sub-headline mở rộng tiêu đề trong 1 câu]</em></p>
<p><strong>By [Tác giả]</strong> · <em>Ngày · Thời gian đọc … phút</em></p>
<p><strong>[Lead paragraph]</strong> — Đoạn mở 30-50 từ trả lời 5W. Hấp dẫn, súc tích.</p>
<h2>[Section 1 — bối cảnh]</h2>
<p>…</p>
<blockquote><p>"Trích dẫn nhân vật — câu key insight." — [Tên + chức vụ]</p></blockquote>
<h2>[Section 2 — phân tích chính]</h2>
<p>Số liệu, ví dụ, câu chuyện cụ thể.</p>
<h2>[Section 3 — góc nhìn ngược / counterpoint]</h2>
<p>Phản biện hoặc rủi ro.</p>
<h2>[Kết — outlook]</h2>
<p>Tương lai sẽ ra sao? Câu hỏi mở cho reader.</p>
<hr>
<p><em>[Tác giả] là … Liên hệ: …</em></p>`,
  },
  {
    id: 'pitch-deck',
    name: 'Pitch deck (text)',
    icon: '🚀',
    category: 'creative',
    description: 'Outline pitch deck startup',
    html: `<h1>[Tên startup] — Pitch Deck</h1>
<p><em>[1-line tagline gây ấn tượng]</em></p>
<h2>1. Vấn đề (The Problem)</h2>
<p>Mô tả pain point cụ thể bằng câu chuyện thật / số liệu.</p>
<h2>2. Giải pháp (The Solution)</h2>
<p>Sản phẩm / dịch vụ giải quyết như thế nào. Demo screenshots.</p>
<h2>3. Thị trường (Market)</h2>
<p><strong>TAM:</strong> $XXX tỷ USD<br>
<strong>SAM:</strong> $XX tỷ<br>
<strong>SOM (3 năm tới):</strong> $X tỷ</p>
<h2>4. Mô hình kinh doanh (Business Model)</h2>
<p>Revenue streams. Pricing. Unit economics.</p>
<h2>5. Lực kéo (Traction)</h2>
<ul>
  <li>… users</li>
  <li>… MRR</li>
  <li>Growth rate …% / month</li>
</ul>
<h2>6. Cạnh tranh (Competition)</h2>
<p>Bảng so sánh với 3-5 đối thủ chính.</p>
<h2>7. Đội ngũ (Team)</h2>
<p>Founders + key hires. Tại sao đội ngũ này win?</p>
<h2>8. Tài chính (Financials)</h2>
<p>Revenue projection 3-5 năm. Burn rate. Runway.</p>
<h2>9. The Ask</h2>
<p>Gọi vốn $X cho equity Y%. Sử dụng như thế nào?</p>
<h2>10. Liên hệ (Contact)</h2>
<p>founder@… · +84 …</p>`,
  },
  {
    id: 'readme',
    name: 'README dự án',
    icon: '📦',
    category: 'creative',
    description: 'README markdown cho repo',
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

  // ============================================================
  // Personal
  // ============================================================
  {
    id: 'diary',
    name: 'Nhật ký',
    icon: '📔',
    category: 'personal',
    description: 'Daily journal / nhật ký cá nhân',
    html: `<h1>Nhật ký · [Thứ, ngày tháng năm]</h1>
<p><em>Thời tiết: … · Tâm trạng: …/10</em></p>
<h2>🌅 Sáng nay</h2>
<p>3 điều biết ơn hôm qua:</p>
<ol><li>…</li><li>…</li><li>…</li></ol>
<p>Mục tiêu hôm nay:</p>
<ul data-type="taskList">
<li data-type="taskItem" data-checked="false"><div><p>…</p></div></li>
<li data-type="taskItem" data-checked="false"><div><p>…</p></div></li>
<li data-type="taskItem" data-checked="false"><div><p>…</p></div></li>
</ul>
<h2>📝 Diễn biến</h2>
<p>Những gì xảy ra hôm nay…</p>
<h2>🌙 Tối nay</h2>
<p><strong>1 thứ học được:</strong> …</p>
<p><strong>1 thứ cải thiện:</strong> …</p>
<p><strong>Mai sẽ làm:</strong> …</p>`,
  },
  {
    id: 'recipe',
    name: 'Công thức nấu ăn',
    icon: '🍲',
    category: 'personal',
    description: 'Recipe template chi tiết',
    html: `<h1>[Tên món]</h1>
<p><em>Khẩu phần: … người · Thời gian chuẩn bị: … phút · Thời gian nấu: … phút · Độ khó: …/5</em></p>
<h2>🥕 Nguyên liệu</h2>
<ul>
  <li>… g [nguyên liệu chính]</li>
  <li>… ml [chất lỏng]</li>
  <li>… (gia vị)</li>
  <li>… (rau thơm)</li>
</ul>
<h2>🔪 Sơ chế</h2>
<ol>
  <li>Rửa sạch …</li>
  <li>Cắt …</li>
  <li>Ướp …</li>
</ol>
<h2>🔥 Cách làm</h2>
<ol>
  <li><strong>Bước 1:</strong> Phi thơm hành tỏi với dầu ăn …</li>
  <li><strong>Bước 2:</strong> Cho … vào xào …</li>
  <li><strong>Bước 3:</strong> Đổ nước, nêm gia vị, đun … phút</li>
  <li><strong>Bước 4:</strong> Trình bày ra đĩa, rắc rau thơm</li>
</ol>
<h2>💡 Mẹo</h2>
<ul>
  <li>Để … ngon hơn, hãy …</li>
  <li>Có thể thay … bằng …</li>
</ul>
<h2>📊 Dinh dưỡng (1 phần)</h2>
<p>Calories: … kcal · Protein: … g · Carbs: … g · Fat: … g</p>`,
  },
  {
    id: 'travel-plan',
    name: 'Kế hoạch du lịch',
    icon: '✈️',
    category: 'personal',
    description: 'Travel itinerary chi tiết',
    html: `<h1>Du lịch [Địa điểm] — [Số ngày]N[Số đêm]Đ</h1>
<p><strong>Từ:</strong> … <strong>Đến:</strong> …<br>
<strong>Người đi:</strong> … · <strong>Ngân sách:</strong> … VND/người</p>
<h2>📋 Tổng quan</h2>
<ul>
  <li>Phương tiện đi: …</li>
  <li>Khách sạn: … (booking: …)</li>
  <li>Thời tiết dự kiến: …</li>
</ul>
<h2>🗓 Lịch trình chi tiết</h2>
<h3>Ngày 1 — [Ngày tháng]</h3>
<ul>
  <li><strong>06:00</strong> — Khởi hành</li>
  <li><strong>10:00</strong> — Check-in khách sạn</li>
  <li><strong>11:30</strong> — Ăn trưa tại …</li>
  <li><strong>13:00</strong> — Tham quan …</li>
  <li><strong>18:00</strong> — Ăn tối + dạo phố</li>
</ul>
<h3>Ngày 2 — [Ngày tháng]</h3>
<ul><li>…</li></ul>
<h2>💰 Ngân sách</h2>
<table>
  <thead><tr><th>Mục</th><th>Chi phí</th></tr></thead>
  <tbody>
    <tr><td>Đi lại (vé máy bay/xe)</td><td>…</td></tr>
    <tr><td>Khách sạn</td><td>…</td></tr>
    <tr><td>Ăn uống</td><td>…</td></tr>
    <tr><td>Tham quan, vé vào cửa</td><td>…</td></tr>
    <tr><td>Phát sinh / mua sắm</td><td>…</td></tr>
    <tr><td><strong>Tổng</strong></td><td><strong>…</strong></td></tr>
  </tbody>
</table>
<h2>🎒 Danh sách đồ mang theo</h2>
<ul data-type="taskList">
<li data-type="taskItem" data-checked="false"><div><p>CMND/Passport</p></div></li>
<li data-type="taskItem" data-checked="false"><div><p>Quần áo (theo thời tiết)</p></div></li>
<li data-type="taskItem" data-checked="false"><div><p>Sạc + power bank</p></div></li>
<li data-type="taskItem" data-checked="false"><div><p>Thuốc cá nhân</p></div></li>
<li data-type="taskItem" data-checked="false"><div><p>Tiền mặt + thẻ</p></div></li>
</ul>`,
  },
];

export function findTemplate(id: string): Template | null {
  return TEMPLATES.find((t) => t.id === id) ?? null;
}

export function templatesByCategory(category: TemplateCategory): Template[] {
  return TEMPLATES.filter((t) => t.category === category);
}
