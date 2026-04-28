/**
 * Bộ câu hỏi ôn thi Tin học văn phòng (sample MVP) — Phase 19.20.
 *
 * 4 chuyên đề:
 *   - word     : MS Word
 *   - excel    : MS Excel
 *   - ppt      : MS PowerPoint
 *   - he-dh-mang : Hệ điều hành + Mạng cơ bản
 */

export type ITTopic = 'word' | 'excel' | 'ppt' | 'he-dh-mang';

export interface ITQuestion {
  id: number;
  topic: ITTopic;
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
}

export const IT_QUESTIONS: ITQuestion[] = [
  // ===== Word =====
  {
    id: 1,
    topic: 'word',
    question: 'Phím tắt nào dùng để in văn bản trong Microsoft Word?',
    options: ['Ctrl + P', 'Ctrl + I', 'Ctrl + N', 'Ctrl + S'],
    correctIndex: 0,
    explanation: 'Ctrl + P (Print) mở hộp thoại in.',
  },
  {
    id: 2,
    topic: 'word',
    question: 'Để chèn ngắt trang trong Word, bạn dùng phím tắt nào?',
    options: ['Enter', 'Shift + Enter', 'Ctrl + Enter', 'Alt + Enter'],
    correctIndex: 2,
    explanation: 'Ctrl + Enter — chèn page break (ngắt trang).',
  },
  {
    id: 3,
    topic: 'word',
    question: 'Tab nào trong Ribbon chứa lệnh "Mail Merge" (Trộn thư)?',
    options: ['Home', 'Insert', 'Mailings', 'Review'],
    correctIndex: 2,
  },
  {
    id: 4,
    topic: 'word',
    question: 'Style là gì trong Word?',
    options: [
      'Một mẫu định dạng có sẵn áp dụng nhanh cho văn bản',
      'Một loại font chữ',
      'Kiểu in giấy',
      'Kích thước trang',
    ],
    correctIndex: 0,
  },
  {
    id: 5,
    topic: 'word',
    question: 'Tổ hợp phím Ctrl + Z dùng để:',
    options: ['Sao chép', 'Hoàn tác (Undo)', 'Cắt', 'Dán'],
    correctIndex: 1,
  },
  {
    id: 6,
    topic: 'word',
    question: 'Để tạo bảng mục lục tự động, bạn cần làm gì trước?',
    options: [
      'Đánh số trang thủ công',
      'Áp dụng các Heading Style cho tiêu đề',
      'In thử văn bản',
      'Chèn footnote',
    ],
    correctIndex: 1,
    explanation: 'Word dựa vào Heading 1/2/3 để sinh Table of Contents.',
  },
  {
    id: 7,
    topic: 'word',
    question: 'Tính năng "Track Changes" có chức năng:',
    options: [
      'Theo dõi thay đổi của tài liệu',
      'Sao chép văn bản',
      'In tài liệu',
      'Tạo password',
    ],
    correctIndex: 0,
  },

  // ===== Excel =====
  {
    id: 8,
    topic: 'excel',
    question: 'Hàm nào tính trung bình cộng các giá trị trong Excel?',
    options: ['SUM', 'AVERAGE', 'COUNT', 'MAX'],
    correctIndex: 1,
  },
  {
    id: 9,
    topic: 'excel',
    question: 'Công thức =VLOOKUP(A1, B:D, 2, FALSE) làm gì?',
    options: [
      'Tìm A1 trong cột B, trả về giá trị tương ứng cột thứ 2 (C), khớp chính xác',
      'Cộng các ô từ B đến D',
      'Đếm số ô có giá trị bằng A1',
      'Sao chép cột B sang D',
    ],
    correctIndex: 0,
    explanation:
      'VLOOKUP(lookup_value, table_array, col_index, [range_lookup]). FALSE = exact match.',
  },
  {
    id: 10,
    topic: 'excel',
    question: 'Phím F4 trong khi nhập công thức có chức năng gì?',
    options: [
      'Mở Help',
      'Chuyển đổi tham chiếu tuyệt đối/tương đối ($A$1 ↔ A1)',
      'Lưu file',
      'Đóng workbook',
    ],
    correctIndex: 1,
  },
  {
    id: 11,
    topic: 'excel',
    question: 'PivotTable được dùng để làm gì?',
    options: [
      'Chỉnh sửa dữ liệu thô',
      'Tổng hợp + phân tích dữ liệu lớn theo chiều khác nhau',
      'In tài liệu',
      'Sao chép sheet',
    ],
    correctIndex: 1,
  },
  {
    id: 12,
    topic: 'excel',
    question: 'Hàm IFERROR(value, [value_if_error]) dùng để:',
    options: [
      'Chỉ tính giá trị dương',
      'Trả về giá trị thay thế khi công thức báo lỗi',
      'Đếm các ô có lỗi',
      'Xóa lỗi trong worksheet',
    ],
    correctIndex: 1,
  },
  {
    id: 13,
    topic: 'excel',
    question: 'Để chuyển dữ liệu từ cột sang hàng (transpose) khi paste, bạn dùng:',
    options: [
      'Ctrl + V',
      'Paste Special → Transpose',
      'Cut + Paste',
      'Drag-and-drop',
    ],
    correctIndex: 1,
  },
  {
    id: 14,
    topic: 'excel',
    question: 'Hàm SUMIFS khác SUMIF ở điểm:',
    options: [
      'Chỉ cộng số nguyên',
      'Cho phép nhiều điều kiện đồng thời',
      'Không cho phép phạm vi',
      'Chỉ làm việc trên 1 sheet',
    ],
    correctIndex: 1,
  },

  // ===== PowerPoint =====
  {
    id: 15,
    topic: 'ppt',
    question: 'Phím tắt F5 trong PowerPoint dùng để:',
    options: [
      'Lưu file',
      'Bắt đầu trình chiếu từ slide đầu',
      'Đóng presentation',
      'Mở Help',
    ],
    correctIndex: 1,
  },
  {
    id: 16,
    topic: 'ppt',
    question: 'Slide Master là gì?',
    options: [
      'Một loại slide đặc biệt để in',
      'Mẫu định dạng chung cho toàn bộ slide trong file',
      'Slide đầu tiên',
      'Chế độ xem 3D',
    ],
    correctIndex: 1,
    explanation: 'Slide Master quản lý layout/font/màu của tất cả slide.',
  },
  {
    id: 17,
    topic: 'ppt',
    question: 'Để chèn animation cho object, dùng tab nào?',
    options: ['Design', 'Transitions', 'Animations', 'Slide Show'],
    correctIndex: 2,
  },
  {
    id: 18,
    topic: 'ppt',
    question: 'Transition khác Animation ở điểm nào?',
    options: [
      'Transition là hiệu ứng giữa các slide; Animation là hiệu ứng cho object trong slide',
      'Hai cái giống nhau',
      'Animation chỉ cho text',
      'Transition chỉ làm việc khi in',
    ],
    correctIndex: 0,
  },
  {
    id: 19,
    topic: 'ppt',
    question: 'Phím Esc trong khi trình chiếu có tác dụng:',
    options: ['Chuyển slide', 'Thoát chế độ trình chiếu', 'In slide', 'Phóng to'],
    correctIndex: 1,
  },

  // ===== Hệ điều hành + Mạng =====
  {
    id: 20,
    topic: 'he-dh-mang',
    question: 'Phím tắt Win + L trong Windows dùng để:',
    options: ['Mở File Explorer', 'Khóa máy', 'Tắt máy', 'Mở Settings'],
    correctIndex: 1,
  },
  {
    id: 21,
    topic: 'he-dh-mang',
    question: 'Địa chỉ IP nào là địa chỉ riêng (private) phổ biến?',
    options: ['8.8.8.8', '192.168.1.1', '203.113.10.5', '1.1.1.1'],
    correctIndex: 1,
    explanation: '192.168.0.0/16 + 10.0.0.0/8 + 172.16.0.0/12 là dải private theo RFC 1918.',
  },
  {
    id: 22,
    topic: 'he-dh-mang',
    question: 'DNS có chức năng gì?',
    options: [
      'Mã hóa dữ liệu',
      'Phân giải tên miền sang địa chỉ IP',
      'Tăng tốc CPU',
      'Quản lý ổ cứng',
    ],
    correctIndex: 1,
  },
  {
    id: 23,
    topic: 'he-dh-mang',
    question: 'HTTPS khác HTTP ở:',
    options: [
      'Tốc độ',
      'Có mã hóa SSL/TLS bảo mật',
      'Chỉ chạy trên Chrome',
      'Không có khác biệt',
    ],
    correctIndex: 1,
  },
  {
    id: 24,
    topic: 'he-dh-mang',
    question: 'File Explorer trong Windows dùng để:',
    options: [
      'Quản lý file và thư mục',
      'Chỉnh sửa ảnh',
      'Lướt web',
      'Phát nhạc',
    ],
    correctIndex: 0,
  },
  {
    id: 25,
    topic: 'he-dh-mang',
    question: 'Phím tắt Ctrl + Shift + Esc trong Windows mở:',
    options: ['Settings', 'Task Manager', 'File Explorer', 'Run'],
    correctIndex: 1,
  },
];

export interface ITTopicConfig {
  topic: ITTopic;
  name: string;
  shortDesc: string;
  questionCount: number;
  passingScore: number;
  durationMin: number;
  color: string;
  icon: string;
}

export const IT_TOPIC_CONFIGS: Record<ITTopic, ITTopicConfig> = {
  word: {
    topic: 'word',
    name: 'Microsoft Word',
    shortDesc: 'Soạn thảo văn bản — định dạng, mail merge, table of contents',
    questionCount: 7,
    passingScore: 5,
    durationMin: 15,
    color: '#2563EB',
    icon: '📝',
  },
  excel: {
    topic: 'excel',
    name: 'Microsoft Excel',
    shortDesc: 'Bảng tính — VLOOKUP, PivotTable, hàm logic',
    questionCount: 7,
    passingScore: 5,
    durationMin: 15,
    color: '#16A34A',
    icon: '📊',
  },
  ppt: {
    topic: 'ppt',
    name: 'PowerPoint',
    shortDesc: 'Trình chiếu — Slide Master, Animation, Transition',
    questionCount: 5,
    passingScore: 4,
    durationMin: 10,
    color: '#DC2626',
    icon: '📽️',
  },
  'he-dh-mang': {
    topic: 'he-dh-mang',
    name: 'Hệ điều hành + Mạng',
    shortDesc: 'Windows, IP, DNS, HTTPS, phím tắt',
    questionCount: 6,
    passingScore: 4,
    durationMin: 12,
    color: '#7C3AED',
    icon: '🖥️',
  },
};

export function getITQuestionsByTopic(t: ITTopic): ITQuestion[] {
  return IT_QUESTIONS.filter((q) => q.topic === t);
}

export function buildITExam(t: ITTopic): ITQuestion[] {
  const all = getITQuestionsByTopic(t);
  const cfg = IT_TOPIC_CONFIGS[t];
  const target = Math.min(cfg.questionCount, all.length);
  return [...all].sort(() => Math.random() - 0.5).slice(0, target);
}

export interface ITExamResult {
  total: number;
  correctCount: number;
  passingScore: number;
  passed: boolean;
  details: {
    question: ITQuestion;
    selectedIndex: number | null;
    isCorrect: boolean;
  }[];
}

export function evaluateITExam(
  t: ITTopic,
  questions: ITQuestion[],
  answers: (number | null)[],
): ITExamResult {
  const cfg = IT_TOPIC_CONFIGS[t];
  let correctCount = 0;
  const details = questions.map((q, i) => {
    const selected = answers[i] ?? null;
    const isCorrect = selected === q.correctIndex;
    if (isCorrect) correctCount++;
    return { question: q, selectedIndex: selected, isCorrect };
  });
  return {
    total: questions.length,
    correctCount,
    passingScore: cfg.passingScore,
    passed: correctCount >= cfg.passingScore,
    details,
  };
}
