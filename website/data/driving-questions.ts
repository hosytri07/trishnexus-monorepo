/**
 * Bộ câu hỏi ôn thi bằng lái xe — Phase 19.5 (sample 30 câu MVP).
 *
 * Bộ đầy đủ 600 câu của Cục đăng kiểm sẽ được nhập sau (anh sourcing nội dung).
 * Hiện file này là sample 30 câu hỏi đủ để demo flow + UI. 
 *
 * Cấu trúc:
 *   - id: số thứ tự
 *   - category: 'concept' (khái niệm) · 'sign' (biển báo) · 'sahinh' (sa hình) ·
 *               'ethics' (đạo đức) · 'technique' (kỹ thuật) · 'culture' (văn hoá)
 *   - question: nội dung câu hỏi
 *   - options: 2-4 lựa chọn
 *   - correctIndex: 0-based
 *   - explanation: giải thích đáp án
 *   - isCritical: câu liệt — sai 1 câu = rớt cả đề
 *   - appliesTo: list mode áp dụng (A1/B1/B2/C)
 */

export type DrivingMode = 'A1' | 'B1' | 'B2' | 'C';

export type QuestionCategory =
  | 'concept'
  | 'sign'
  | 'sahinh'
  | 'ethics'
  | 'technique'
  | 'culture';

export interface DrivingQuestion {
  id: number;
  category: QuestionCategory;
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
  isCritical?: boolean;
  appliesTo: DrivingMode[];
}

export const DRIVING_QUESTIONS: DrivingQuestion[] = [
  // ── Khái niệm + luật chung ──
  {
    id: 1,
    category: 'concept',
    question:
      '"Phần đường xe chạy" là phần của đường bộ được sử dụng cho phương tiện giao thông đường bộ đi lại. Khái niệm trên được hiểu như thế nào là đúng?',
    options: [
      'Phần mặt đường được dùng cho các phương tiện đi lại',
      'Phần đường bộ được sử dụng cho các phương tiện giao thông đường bộ đi lại',
      'Là phần đường để các phương tiện cơ giới đi lại',
    ],
    correctIndex: 1,
    explanation: 'Đáp án 2 — định nghĩa chính xác theo Luật GTĐB.',
    appliesTo: ['A1', 'B1', 'B2', 'C'],
  },
  {
    id: 2,
    category: 'concept',
    question:
      '"Làn đường" là gì?',
    options: [
      'Là một phần của phần đường xe chạy được chia theo chiều dọc của đường, có đủ bề rộng cho xe chạy an toàn',
      'Là một phần của phần đường xe chạy được phân định bằng vạch sơn',
      'Là một phần của lề đường dùng cho xe chạy',
    ],
    correctIndex: 0,
    appliesTo: ['A1', 'B1', 'B2', 'C'],
  },
  {
    id: 3,
    category: 'concept',
    question:
      'Trong các khái niệm dưới đây, "dải phân cách" được hiểu như thế nào là đúng?',
    options: [
      'Là bộ phận của đường để phân chia mặt đường thành hai chiều xe chạy riêng biệt',
      'Là bộ phận của đường để phân chia phần đường của xe cơ giới và xe thô sơ',
      'Cả 2 đáp án trên',
    ],
    correctIndex: 2,
    appliesTo: ['A1', 'B1', 'B2', 'C'],
  },

  // ── Câu liệt (60 câu sai 1 câu rớt) ──
  {
    id: 4,
    category: 'ethics',
    question:
      'Người đã uống rượu, bia mà điều khiển xe ô tô tham gia giao thông trên đường thì có vi phạm pháp luật không?',
    options: [
      'Không vi phạm',
      'Vi phạm khi nồng độ cồn vượt mức cho phép',
      'Vi phạm trong mọi trường hợp khi có nồng độ cồn trong máu hoặc hơi thở',
    ],
    correctIndex: 2,
    explanation:
      'CÂU LIỆT — Theo Luật GTĐB sửa đổi 2019, ô tô tuyệt đối không được có cồn khi lái.',
    isCritical: true,
    appliesTo: ['B1', 'B2', 'C'],
  },
  {
    id: 5,
    category: 'ethics',
    question:
      'Người điều khiển xe mô tô hai bánh, ba bánh có nồng độ cồn vượt quá bao nhiêu thì bị cấm lái xe?',
    options: [
      '50 miligam/100 mililit máu',
      '40 miligam/1 lit khí thở',
      'Có nồng độ cồn trong máu hoặc hơi thở',
    ],
    correctIndex: 2,
    explanation: 'CÂU LIỆT — Cấm tuyệt đối có cồn khi điều khiển mô tô.',
    isCritical: true,
    appliesTo: ['A1'],
  },
  {
    id: 6,
    category: 'ethics',
    question:
      'Người lái xe ô tô không được gây tiếng ồn lớn, tránh phóng nhanh vượt ẩu trong khu dân cư. Hành vi này thuộc về:',
    options: [
      'Đạo đức nghề nghiệp',
      'Luật giao thông đường bộ',
      'Cả hai',
    ],
    correctIndex: 2,
    appliesTo: ['B1', 'B2', 'C'],
  },

  // ── Biển báo ──
  {
    id: 7,
    category: 'sign',
    question:
      'Biển nào dưới đây cấm xe ô tô (xe con) đi vào?',
    options: [
      'Biển 1 (vòng đỏ với hình ô tô con)',
      'Biển 2 (vòng đỏ với hình ô tô và mô tô)',
      'Cả hai biển',
    ],
    correctIndex: 0,
    explanation: 'Biển 1 (P.103a) cấm ô tô con cụ thể.',
    appliesTo: ['B1', 'B2', 'C'],
  },
  {
    id: 8,
    category: 'sign',
    question:
      'Biển báo "Đường giao nhau với đường ưu tiên" có hình tam giác nền vàng, viền đỏ, ý nghĩa là gì?',
    options: [
      'Báo gần đến nơi giao nhau với đường ưu tiên, người lái phải nhường đường',
      'Cấm rẽ phải',
      'Cảnh báo đoạn đường có ổ gà',
    ],
    correctIndex: 0,
    appliesTo: ['A1', 'B1', 'B2', 'C'],
  },
  {
    id: 9,
    category: 'sign',
    question:
      'Biển nào báo hiệu "Đường một chiều"?',
    options: [
      'Biển hình tròn nền xanh, mũi tên trắng đi thẳng',
      'Biển hình chữ nhật nền xanh, mũi tên trắng đi thẳng',
      'Biển hình tam giác có 2 mũi tên',
    ],
    correctIndex: 1,
    explanation: 'Biển R.407a hình chữ nhật nền xanh.',
    appliesTo: ['A1', 'B1', 'B2', 'C'],
  },
  {
    id: 10,
    category: 'sign',
    question:
      'Biển báo "Cấm rẽ trái" áp dụng cho loại xe nào?',
    options: [
      'Tất cả các loại xe trừ xe ưu tiên',
      'Chỉ ô tô',
      'Chỉ mô tô',
    ],
    correctIndex: 0,
    appliesTo: ['A1', 'B1', 'B2', 'C'],
  },

  // ── Kỹ thuật lái xe ──
  {
    id: 11,
    category: 'technique',
    question:
      'Khi xe đang chạy, gặp đoạn đường ngập nước, người lái nên xử lý thế nào?',
    options: [
      'Tăng ga vượt nhanh qua đoạn ngập',
      'Giảm tốc độ, rà phanh nhẹ, giữ ga đều, không đổi số đột ngột',
      'Tắt máy để nước không vào động cơ',
    ],
    correctIndex: 1,
    appliesTo: ['B1', 'B2', 'C'],
  },
  {
    id: 12,
    category: 'technique',
    question:
      'Xe có tay lái trợ lực dầu mà bị rò dầu, người lái cần làm gì?',
    options: [
      'Vẫn lái bình thường, sửa sau',
      'Dừng xe, không tiếp tục di chuyển cho đến khi sửa xong',
      'Châm thêm dầu rồi đi tiếp',
    ],
    correctIndex: 1,
    appliesTo: ['B1', 'B2', 'C'],
  },
  {
    id: 13,
    category: 'technique',
    question:
      'Khi vượt xe khác, người điều khiển xe phải làm gì?',
    options: [
      'Bấm còi, nháy đèn xin vượt, vượt bên trái khi đảm bảo an toàn',
      'Tăng tốc vượt qua mặt xe phía trước',
      'Đi sát mép phải để vượt nhanh',
    ],
    correctIndex: 0,
    appliesTo: ['A1', 'B1', 'B2', 'C'],
  },
  {
    id: 14,
    category: 'technique',
    question:
      'Khi lái xe trên đường cao tốc, khoảng cách an toàn với xe phía trước ở tốc độ 100 km/h là?',
    options: ['35 mét', '70 mét', '100 mét'],
    correctIndex: 1,
    explanation:
      'Theo Thông tư 31/2019: tốc độ 80-100 km/h → khoảng cách tối thiểu 70m.',
    appliesTo: ['B1', 'B2', 'C'],
  },

  // ── Sa hình ──
  {
    id: 15,
    category: 'sahinh',
    question:
      'Tại nơi đường giao nhau không có tín hiệu đèn, các xe đi theo thứ tự nào?',
    options: [
      'Xe đi từ bên phải vào trước, rồi đến xe đi vào sau',
      'Xe nào tới trước đi trước, không phân biệt hướng',
      'Xe ưu tiên → xe trên đường ưu tiên → xe đến từ bên phải',
    ],
    correctIndex: 2,
    appliesTo: ['A1', 'B1', 'B2', 'C'],
  },
  {
    id: 16,
    category: 'sahinh',
    question:
      'Khi 2 xe đi ngược chiều gặp nhau trên đoạn đường hẹp, xe nào nhường?',
    options: [
      'Xe lên dốc nhường xe xuống dốc',
      'Xe xuống dốc nhường xe lên dốc',
      'Xe có tải trọng lớn nhường xe nhỏ',
    ],
    correctIndex: 1,
    explanation:
      'Xe xuống dốc dễ kiểm soát hơn → phải nhường đường cho xe lên dốc.',
    appliesTo: ['B1', 'B2', 'C'],
  },
  {
    id: 17,
    category: 'sahinh',
    question:
      'Tại nơi giao nhau có đèn vàng nhấp nháy, người lái phải làm gì?',
    options: [
      'Dừng lại',
      'Giảm tốc độ, chú ý quan sát, ưu tiên xe ưu tiên đi qua',
      'Tăng tốc qua nhanh',
    ],
    correctIndex: 1,
    appliesTo: ['A1', 'B1', 'B2', 'C'],
  },

  // ── Văn hoá lái xe ──
  {
    id: 18,
    category: 'culture',
    question:
      'Khi gặp người đi bộ qua đường ở nơi không có vạch kẻ đường người đi bộ, người lái cần?',
    options: [
      'Bấm còi để báo hiệu',
      'Chủ động giảm tốc, nhường đường cho người đi bộ qua đường an toàn',
      'Tăng tốc vượt qua nhanh trước',
    ],
    correctIndex: 1,
    appliesTo: ['A1', 'B1', 'B2', 'C'],
  },
  {
    id: 19,
    category: 'culture',
    question:
      'Khi xe phía sau xin vượt mà có đủ điều kiện an toàn, người lái xe phía trước phải:',
    options: [
      'Tăng tốc để xe sau không vượt được',
      'Giảm tốc độ, đi sát về bên phải, ra hiệu cho xe sau vượt',
      'Đi giữa lòng đường để xe sau không vượt',
    ],
    correctIndex: 1,
    isCritical: true,
    explanation: 'CÂU LIỆT — Văn hoá nhường đường khi vượt là điều quan trọng nhất.',
    appliesTo: ['A1', 'B1', 'B2', 'C'],
  },

  // ── Khái niệm tiếp ──
  {
    id: 20,
    category: 'concept',
    question:
      'Xe quá tải trọng cho phép so với thiết kế cầu thì có được phép qua không?',
    options: [
      'Được, nhưng phải đi chậm',
      'Không được, phải tìm đường khác',
      'Được, nếu cầu chưa hỏng',
    ],
    correctIndex: 1,
    appliesTo: ['B2', 'C'],
  },
  {
    id: 21,
    category: 'concept',
    question:
      'Người lái xe ô tô tải có giấy phép B2 được phép lái loại xe nào?',
    options: [
      'Ô tô tải có trọng tải dưới 3,5 tấn',
      'Ô tô tải có trọng tải dưới 7,5 tấn',
      'Ô tô tải mọi trọng tải',
    ],
    correctIndex: 0,
    appliesTo: ['B2'],
  },
  {
    id: 22,
    category: 'concept',
    question: 'Người có giấy phép lái xe A1 được phép điều khiển:',
    options: [
      'Mô tô hai bánh có dung tích xi-lanh từ 50cm³ đến dưới 175cm³',
      'Mô tô hai bánh có dung tích xi-lanh từ 175cm³ trở lên',
      'Mô tô ba bánh',
    ],
    correctIndex: 0,
    appliesTo: ['A1'],
  },
  {
    id: 23,
    category: 'concept',
    question:
      'Tốc độ tối đa cho phép của xe ô tô con trong khu dân cư có dải phân cách giữa là?',
    options: ['50 km/h', '60 km/h', '70 km/h'],
    correctIndex: 1,
    explanation:
      'Thông tư 31/2019: trong khu dân cư có dải phân cách giữa, ô tô con tối đa 60 km/h.',
    appliesTo: ['B1', 'B2', 'C'],
  },

  // ── Biển báo tiếp ──
  {
    id: 24,
    category: 'sign',
    question:
      'Biển báo "Đường ưu tiên" có hình dạng và màu sắc như thế nào?',
    options: [
      'Hình thoi, nền vàng, viền đen',
      'Hình tròn, nền xanh, viền trắng',
      'Hình tam giác, nền vàng, viền đỏ',
    ],
    correctIndex: 0,
    appliesTo: ['A1', 'B1', 'B2', 'C'],
  },
  {
    id: 25,
    category: 'sign',
    question:
      'Biển nào báo hiệu cuối đường ưu tiên?',
    options: [
      'Biển hình thoi nền vàng có gạch chéo đen',
      'Biển tam giác viền đỏ',
      'Biển tròn nền đỏ',
    ],
    correctIndex: 0,
    appliesTo: ['A1', 'B1', 'B2', 'C'],
  },

  // ── Kỹ thuật ──
  {
    id: 26,
    category: 'technique',
    question:
      'Khi xe đột nhiên mất phanh, người lái cần ưu tiên xử lý như thế nào?',
    options: [
      'Tắt động cơ và xuống số thấp dần để phanh động cơ, kết hợp phanh tay từ từ',
      'Đạp côn và tắt máy ngay',
      'Bấm còi liên tục để cảnh báo',
    ],
    correctIndex: 0,
    appliesTo: ['B1', 'B2', 'C'],
  },
  {
    id: 27,
    category: 'technique',
    question:
      'Khi xe đỗ trên dốc có độ dốc lớn, ngoài kéo phanh tay, người lái còn cần?',
    options: [
      'Đặt số ở vị trí số 1 (nếu lên dốc) hoặc số lùi (nếu xuống dốc), chèn bánh xe',
      'Để hộp số ở vị trí trung gian',
      'Tắt động cơ là đủ',
    ],
    correctIndex: 0,
    appliesTo: ['B1', 'B2', 'C'],
  },
  {
    id: 28,
    category: 'technique',
    question:
      'Khi tham gia giao thông trong điều kiện sương mù, người lái cần?',
    options: [
      'Bật đèn pha chiếu xa',
      'Bật đèn cốt (chiếu gần) và đèn sương mù, giảm tốc độ, giữ khoảng cách',
      'Tắt đèn để tiết kiệm điện',
    ],
    correctIndex: 1,
    appliesTo: ['A1', 'B1', 'B2', 'C'],
  },
  {
    id: 29,
    category: 'culture',
    question:
      'Khi xe có em bé hoặc người già, người lái cần?',
    options: [
      'Lái nhanh để đến nơi sớm',
      'Lái cẩn thận, êm ái, không phanh gấp, không tăng tốc đột ngột',
      'Mở nhạc to để giải trí',
    ],
    correctIndex: 1,
    appliesTo: ['B1', 'B2', 'C'],
  },
  {
    id: 30,
    category: 'ethics',
    question:
      'Khi gây tai nạn rồi bỏ chạy, người lái có thể bị xử lý thế nào?',
    options: [
      'Phạt hành chính',
      'Truy cứu trách nhiệm hình sự, tước GPLX',
      'Cảnh cáo bằng văn bản',
    ],
    correctIndex: 1,
    isCritical: true,
    explanation: 'CÂU LIỆT — Bỏ chạy sau tai nạn là tội hình sự.',
    appliesTo: ['B1', 'B2', 'C'],
  },
];

// ============================================================
// Helpers
// ============================================================

export interface ModeConfig {
  mode: DrivingMode;
  name: string;
  shortDesc: string;
  questionCount: number;
  passingScore: number;
  durationMin: number;
  color: string;
}

export const MODE_CONFIGS: Record<DrivingMode, ModeConfig> = {
  A1: {
    mode: 'A1',
    name: 'Hạng A1',
    shortDesc: 'Mô tô 50-175cm³',
    questionCount: 25,
    passingScore: 21,
    durationMin: 19,
    color: '#10B981',
  },
  B1: {
    mode: 'B1',
    name: 'Hạng B1',
    shortDesc: 'Ô tô con không hành nghề',
    questionCount: 30,
    passingScore: 27,
    durationMin: 22,
    color: '#3B82F6',
  },
  B2: {
    mode: 'B2',
    name: 'Hạng B2',
    shortDesc: 'Ô tô < 9 chỗ + tải < 3.5T',
    questionCount: 35,
    passingScore: 32,
    durationMin: 24,
    color: '#8B5CF6',
  },
  C: {
    mode: 'C',
    name: 'Hạng C',
    shortDesc: 'Ô tô tải > 3.5T',
    questionCount: 40,
    passingScore: 36,
    durationMin: 26,
    color: '#F59E0B',
  },
};

/** Lấy danh sách câu hỏi áp dụng cho mode */
export function getQuestionsForMode(mode: DrivingMode): DrivingQuestion[] {
  return DRIVING_QUESTIONS.filter((q) => q.appliesTo.includes(mode));
}

/** Lấy danh sách câu liệt áp dụng cho mode */
export function getCriticalQuestionsForMode(mode: DrivingMode): DrivingQuestion[] {
  return DRIVING_QUESTIONS.filter(
    (q) => q.isCritical && q.appliesTo.includes(mode),
  );
}

/** Random N câu cho 1 đề thi (mix bao gồm câu liệt nếu có) */
export function buildExam(mode: DrivingMode): DrivingQuestion[] {
  const all = getQuestionsForMode(mode);
  const config = MODE_CONFIGS[mode];
  const target = Math.min(config.questionCount, all.length);
  // Shuffle
  const shuffled = [...all].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, target);
}

/** Tính kết quả: số đúng + có pass không + có sai câu liệt không */
export interface ExamResult {
  total: number;
  correctCount: number;
  criticalWrong: number;
  passingScore: number;
  passed: boolean;
  details: {
    question: DrivingQuestion;
    selectedIndex: number | null;
    isCorrect: boolean;
  }[];
}

export function evaluateExam(
  mode: DrivingMode,
  questions: DrivingQuestion[],
  answers: (number | null)[],
): ExamResult {
  const config = MODE_CONFIGS[mode];
  let correctCount = 0;
  let criticalWrong = 0;
  const details = questions.map((q, i) => {
    const selected = answers[i] ?? null;
    const isCorrect = selected === q.correctIndex;
    if (isCorrect) correctCount++;
    else if (q.isCritical) criticalWrong++;
    return { question: q, selectedIndex: selected, isCorrect };
  });
  const passed = correctCount >= config.passingScore && criticalWrong === 0;
  return {
    total: questions.length,
    correctCount,
    criticalWrong,
    passingScore: config.passingScore,
    passed,
    details,
  };
}
