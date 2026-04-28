/**
 * Bộ câu hỏi ôn thi chứng chỉ hành nghề Xây dựng — Phase 19.6 (sample 20 câu MVP).
 *
 * 3 chuyên ngành chính:
 *   - dinh-gia    : Định giá xây dựng
 *   - giam-sat    : Giám sát thi công xây dựng
 *   - an-toan-ld  : An toàn lao động trong xây dựng
 *
 * Bộ đầy đủ theo Thông tư BXD sẽ được nhập sau (anh sourcing nội dung).
 */

export type CertSpecialty = 'dinh-gia' | 'giam-sat' | 'an-toan-ld';

export interface CertQuestion {
  id: number;
  specialty: CertSpecialty;
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
}

export const CERT_QUESTIONS: CertQuestion[] = [
  // ── Định giá ──
  {
    id: 1,
    specialty: 'dinh-gia',
    question:
      'Theo Nghị định 10/2021/NĐ-CP, tổng mức đầu tư xây dựng được phê duyệt là cơ sở để:',
    options: [
      'Lập kế hoạch ngân sách hàng năm',
      'Quản lý chi phí, lập tổng dự toán và kiểm soát chi phí',
      'Đấu thầu dự án',
    ],
    correctIndex: 1,
    explanation: 'Tổng mức đầu tư là cơ sở để quản lý chi phí trong toàn bộ quá trình thực hiện dự án.',
  },
  {
    id: 2,
    specialty: 'dinh-gia',
    question:
      'Định mức dự toán xây dựng công trình được áp dụng để:',
    options: [
      'Tính khối lượng vật liệu, nhân công, máy thi công cho công tác xây dựng',
      'Quyết toán công trình',
      'Báo cáo tài chính',
    ],
    correctIndex: 0,
  },
  {
    id: 3,
    specialty: 'dinh-gia',
    question:
      'Hệ số K trượt giá trong dự toán xây dựng có tác dụng:',
    options: [
      'Điều chỉnh chi phí theo lạm phát hoặc biến động giá vật liệu',
      'Tính thuế giá trị gia tăng',
      'Phạt do chậm tiến độ',
    ],
    correctIndex: 0,
  },
  {
    id: 4,
    specialty: 'dinh-gia',
    question:
      'Chi phí tư vấn đầu tư xây dựng bao gồm:',
    options: [
      'Chi phí thiết kế, giám sát, lập dự án, thẩm tra',
      'Chỉ chi phí thiết kế và giám sát',
      'Chỉ chi phí lập dự án đầu tư',
    ],
    correctIndex: 0,
  },
  {
    id: 5,
    specialty: 'dinh-gia',
    question:
      'Theo Nghị định 10/2021/NĐ-CP, dự toán xây dựng công trình bao gồm:',
    options: [
      'Chi phí xây dựng + thiết bị + tư vấn + quản lý dự án + chi phí khác + dự phòng',
      'Chỉ chi phí xây dựng và thiết bị',
      'Tổng giá trị hợp đồng thi công',
    ],
    correctIndex: 0,
  },
  {
    id: 6,
    specialty: 'dinh-gia',
    question:
      'Phương pháp tính chi phí xây dựng theo khối lượng được sử dụng khi:',
    options: [
      'Đã có thiết kế chi tiết và bản tiên lượng đầy đủ',
      'Chỉ có chủ trương đầu tư',
      'Đang trong giai đoạn nghiên cứu khả thi',
    ],
    correctIndex: 0,
  },
  {
    id: 7,
    specialty: 'dinh-gia',
    question:
      'Chỉ số giá xây dựng được công bố bởi:',
    options: [
      'Bộ Tài chính',
      'Bộ Xây dựng và UBND cấp tỉnh',
      'Bộ Kế hoạch & Đầu tư',
    ],
    correctIndex: 1,
  },

  // ── Giám sát ──
  {
    id: 8,
    specialty: 'giam-sat',
    question:
      'Người giám sát thi công xây dựng phải:',
    options: [
      'Có chứng chỉ hành nghề giám sát phù hợp với hạng công trình',
      'Là kỹ sư xây dựng tốt nghiệp đại học',
      'Có ít nhất 5 năm kinh nghiệm',
    ],
    correctIndex: 0,
    explanation: 'Theo Luật Xây dựng 2014 sửa đổi 2020, giám sát phải có chứng chỉ hạng phù hợp.',
  },
  {
    id: 9,
    specialty: 'giam-sat',
    question:
      'Khi phát hiện công tác thi công không đảm bảo chất lượng, giám sát phải:',
    options: [
      'Yêu cầu nhà thầu dừng thi công và lập biên bản',
      'Báo lên chủ đầu tư rồi chờ ý kiến',
      'Tiếp tục giám sát và báo cáo cuối tuần',
    ],
    correctIndex: 0,
  },
  {
    id: 10,
    specialty: 'giam-sat',
    question:
      'Nhật ký giám sát thi công phải được:',
    options: [
      'Ghi chép hàng ngày với đầy đủ thông tin về thời tiết, công việc, sự cố, vật liệu',
      'Ghi chép hàng tuần',
      'Chỉ ghi khi có sự cố',
    ],
    correctIndex: 0,
  },
  {
    id: 11,
    specialty: 'giam-sat',
    question:
      'Kiểm tra vật liệu trước khi sử dụng cho công trình bao gồm:',
    options: [
      'Kiểm tra chứng chỉ chất lượng, nguồn gốc xuất xứ và lấy mẫu thí nghiệm',
      'Chỉ kiểm tra ngoại quan vật liệu',
      'Tin tưởng vào chứng chỉ của nhà cung cấp',
    ],
    correctIndex: 0,
  },
  {
    id: 12,
    specialty: 'giam-sat',
    question:
      'Nghiệm thu công việc xây dựng được thực hiện:',
    options: [
      'Theo từng giai đoạn thi công sau khi hoàn thành công đoạn đó',
      'Chỉ khi hoàn thành toàn bộ công trình',
      'Theo yêu cầu của chủ đầu tư',
    ],
    correctIndex: 0,
  },
  {
    id: 13,
    specialty: 'giam-sat',
    question:
      'Khi có sự thay đổi thiết kế trong quá trình thi công, người giám sát phải:',
    options: [
      'Yêu cầu lập hồ sơ thay đổi thiết kế và được cấp có thẩm quyền phê duyệt',
      'Cho phép thay đổi nếu nhà thầu đồng ý',
      'Tự quyết định cho phép thay đổi nếu hợp lý',
    ],
    correctIndex: 0,
  },

  // ── An toàn lao động ──
  {
    id: 14,
    specialty: 'an-toan-ld',
    question:
      'Khi làm việc trên cao từ 2m trở lên, người lao động phải:',
    options: [
      'Đeo dây an toàn móc vào điểm cố định, có lưới chống rơi nếu cần',
      'Chỉ cần đi giày chống trượt',
      'Cẩn thận khi đi lại',
    ],
    correctIndex: 0,
    explanation: 'Theo TCVN 5308:2008, làm việc trên cao ≥ 2m bắt buộc dùng dây an toàn.',
  },
  {
    id: 15,
    specialty: 'an-toan-ld',
    question:
      'PPE (Personal Protective Equipment) cơ bản trên công trường gồm:',
    options: [
      'Mũ bảo hộ, giày bảo hộ, găng tay, kính bảo hộ, áo phản quang',
      'Chỉ mũ bảo hộ và giày',
      'Chỉ áo phản quang',
    ],
    correctIndex: 0,
  },
  {
    id: 16,
    specialty: 'an-toan-ld',
    question:
      'Khi xảy ra tai nạn lao động chết người, đơn vị thi công phải:',
    options: [
      'Báo ngay cho cơ quan chức năng, giữ nguyên hiện trường, lập biên bản',
      'Đưa nạn nhân đi cấp cứu, dọn hiện trường để tiếp tục thi công',
      'Báo nội bộ rồi xử lý sau',
    ],
    correctIndex: 0,
  },
  {
    id: 17,
    specialty: 'an-toan-ld',
    question:
      'Giàn giáo thi công phải được:',
    options: [
      'Kiểm tra trước khi sử dụng và định kỳ theo quy định, có biên bản nghiệm thu',
      'Lắp đặt theo kinh nghiệm',
      'Chỉ kiểm tra khi nghi ngờ có vấn đề',
    ],
    correctIndex: 0,
  },
  {
    id: 18,
    specialty: 'an-toan-ld',
    question:
      'Khi đào hố sâu hơn 1.25m, cần phải:',
    options: [
      'Có biện pháp chống sạt lở (chống vách, taluy, hệ thống cọc cừ)',
      'Đào nhanh để hoàn thành sớm',
      'Đặt biển báo cấm vào',
    ],
    correctIndex: 0,
  },
  {
    id: 19,
    specialty: 'an-toan-ld',
    question:
      'Khi có giông sét, công việc nào phải dừng ngay?',
    options: [
      'Tất cả công việc trên cao, gần kim loại lớn, gần đường dây điện',
      'Chỉ công việc ngoài trời',
      'Không cần dừng nếu mặc đồ bảo hộ',
    ],
    correctIndex: 0,
  },
  {
    id: 20,
    specialty: 'an-toan-ld',
    question:
      'Người lao động có quyền:',
    options: [
      'Từ chối làm công việc có nguy cơ tai nạn lao động khi chưa được trang bị bảo hộ phù hợp',
      'Chỉ làm việc trong giờ hành chính',
      'Tự ý nghỉ khi cảm thấy không an toàn',
    ],
    correctIndex: 0,
  },
];

export interface CertSpecialtyConfig {
  specialty: CertSpecialty;
  name: string;
  shortDesc: string;
  questionCount: number;
  passingScore: number;
  durationMin: number;
  color: string;
  icon: string;
}

export const CERT_SPECIALTY_CONFIGS: Record<CertSpecialty, CertSpecialtyConfig> = {
  'dinh-gia': {
    specialty: 'dinh-gia',
    name: 'Định giá xây dựng',
    shortDesc: 'Lập tổng mức đầu tư, dự toán, quyết toán',
    questionCount: 25,
    passingScore: 18,
    durationMin: 60,
    color: '#10B981',
    icon: '💰',
  },
  'giam-sat': {
    specialty: 'giam-sat',
    name: 'Giám sát thi công',
    shortDesc: 'Quản lý chất lượng + tiến độ + an toàn công trình',
    questionCount: 25,
    passingScore: 18,
    durationMin: 60,
    color: '#3B82F6',
    icon: '👁',
  },
  'an-toan-ld': {
    specialty: 'an-toan-ld',
    name: 'An toàn lao động',
    shortDesc: 'PPE + làm việc trên cao + sự cố + cứu nạn',
    questionCount: 25,
    passingScore: 18,
    durationMin: 60,
    color: '#F59E0B',
    icon: '🦺',
  },
};

export function getCertQuestionsForSpecialty(s: CertSpecialty): CertQuestion[] {
  return CERT_QUESTIONS.filter((q) => q.specialty === s);
}

export function buildCertExam(s: CertSpecialty): CertQuestion[] {
  const all = getCertQuestionsForSpecialty(s);
  const cfg = CERT_SPECIALTY_CONFIGS[s];
  const target = Math.min(cfg.questionCount, all.length);
  const shuffled = [...all].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, target);
}

export interface CertExamResult {
  total: number;
  correctCount: number;
  passingScore: number;
  passed: boolean;
  details: {
    question: CertQuestion;
    selectedIndex: number | null;
    isCorrect: boolean;
  }[];
}

export function evaluateCertExam(
  s: CertSpecialty,
  questions: CertQuestion[],
  answers: (number | null)[],
): CertExamResult {
  const cfg = CERT_SPECIALTY_CONFIGS[s];
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
