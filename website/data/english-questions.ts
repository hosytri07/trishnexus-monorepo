/**
 * Bộ câu hỏi ôn thi Tiếng Anh (sample MVP) — Phase 19.20.
 *
 * 4 chuyên đề (level theo CEFR):
 *   - grammar : Ngữ pháp (A2-B1)
 *   - vocab   : Từ vựng (A2-B2)
 *   - reading : Đọc hiểu ngắn (B1-B2)
 *   - business : Tiếng Anh thương mại / TOEIC
 */

export type EnglishTopic = 'grammar' | 'vocab' | 'reading' | 'business';

export interface EnglishQuestion {
  id: number;
  topic: EnglishTopic;
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
  /** Cho reading — đoạn văn ngữ cảnh (markdown nhẹ) */
  passage?: string;
}

export const ENGLISH_QUESTIONS: EnglishQuestion[] = [
  // ===== Grammar =====
  {
    id: 1,
    topic: 'grammar',
    question: 'She _____ to school every day.',
    options: ['go', 'goes', 'going', 'gone'],
    correctIndex: 1,
    explanation: 'Present simple — chủ ngữ ngôi 3 số ít → động từ +s/es.',
  },
  {
    id: 2,
    topic: 'grammar',
    question: 'If I _____ rich, I would travel the world.',
    options: ['am', 'was', 'were', 'be'],
    correctIndex: 2,
    explanation: 'Câu điều kiện loại 2 — sử dụng "were" cho tất cả ngôi.',
  },
  {
    id: 3,
    topic: 'grammar',
    question: 'I have lived here _____ 2010.',
    options: ['since', 'for', 'in', 'at'],
    correctIndex: 0,
    explanation: '"Since" + mốc thời gian; "for" + khoảng thời gian.',
  },
  {
    id: 4,
    topic: 'grammar',
    question: 'The book _____ on the table belongs to me.',
    options: ['lay', 'lying', 'laying', 'lied'],
    correctIndex: 1,
    explanation: 'Reduced relative clause: "The book which is lying on the table".',
  },
  {
    id: 5,
    topic: 'grammar',
    question: 'She is _____ than her sister.',
    options: ['tall', 'taller', 'tallest', 'more tall'],
    correctIndex: 1,
  },
  {
    id: 6,
    topic: 'grammar',
    question: 'By next year, I _____ here for ten years.',
    options: ['will work', 'have worked', 'will have worked', 'worked'],
    correctIndex: 2,
    explanation: 'Future perfect — "by + thời điểm tương lai".',
  },
  {
    id: 7,
    topic: 'grammar',
    question: 'The window _____ by the wind last night.',
    options: ['broke', 'was broken', 'has broken', 'broken'],
    correctIndex: 1,
    explanation: 'Bị động quá khứ đơn: was/were + V3.',
  },

  // ===== Vocabulary =====
  {
    id: 8,
    topic: 'vocab',
    question: 'What is the synonym of "happy"?',
    options: ['Sad', 'Angry', 'Joyful', 'Tired'],
    correctIndex: 2,
  },
  {
    id: 9,
    topic: 'vocab',
    question: 'Choose the antonym of "expensive":',
    options: ['Costly', 'Cheap', 'High', 'Wide'],
    correctIndex: 1,
  },
  {
    id: 10,
    topic: 'vocab',
    question: '"Reluctant" means:',
    options: ['Eager', 'Unwilling', 'Quick', 'Brave'],
    correctIndex: 1,
    explanation: 'Reluctant = miễn cưỡng, không sẵn lòng.',
  },
  {
    id: 11,
    topic: 'vocab',
    question: 'A "civil engineer" works mainly with:',
    options: [
      'Computer software',
      'Roads, bridges, buildings, water systems',
      'Medical research',
      'Stock market',
    ],
    correctIndex: 1,
  },
  {
    id: 12,
    topic: 'vocab',
    question: 'Which word means "to make stronger"?',
    options: ['Weaken', 'Reinforce', 'Reduce', 'Remove'],
    correctIndex: 1,
  },
  {
    id: 13,
    topic: 'vocab',
    question: 'In construction, "blueprint" means:',
    options: [
      'A type of paint',
      'A detailed technical drawing',
      'A blue color',
      'A safety helmet',
    ],
    correctIndex: 1,
  },

  // ===== Reading =====
  {
    id: 14,
    topic: 'reading',
    passage:
      'The new bridge over the Red River will open next month. It is 1.2 kilometers long and has six lanes for vehicles plus two pedestrian walkways. Construction began in 2022 and cost approximately 5 trillion VND. The bridge is expected to reduce traffic congestion in the area by 40%.',
    question: 'How long is the bridge?',
    options: ['1 km', '1.2 km', '2 km', '600 m'],
    correctIndex: 1,
  },
  {
    id: 15,
    topic: 'reading',
    passage:
      'The new bridge over the Red River will open next month. It is 1.2 kilometers long and has six lanes for vehicles plus two pedestrian walkways. Construction began in 2022 and cost approximately 5 trillion VND. The bridge is expected to reduce traffic congestion in the area by 40%.',
    question: 'According to the passage, what is the expected benefit of the bridge?',
    options: [
      'Cheaper transportation',
      'Less air pollution',
      'Reducing traffic congestion by 40%',
      'New tourist attraction',
    ],
    correctIndex: 2,
  },
  {
    id: 16,
    topic: 'reading',
    passage:
      'Concrete is one of the most widely used construction materials in the world. It is made from cement, water, sand, and aggregate (small stones). When mixed correctly and allowed to cure, concrete becomes very strong and durable. However, it is weak in tension, so steel reinforcement is often added to create reinforced concrete (RC).',
    question: 'What are the main ingredients of concrete?',
    options: [
      'Wood, nails, water',
      'Cement, water, sand, aggregate',
      'Plastic, sand, water',
      'Steel only',
    ],
    correctIndex: 1,
  },
  {
    id: 17,
    topic: 'reading',
    passage:
      'Concrete is one of the most widely used construction materials in the world. It is made from cement, water, sand, and aggregate (small stones). When mixed correctly and allowed to cure, concrete becomes very strong and durable. However, it is weak in tension, so steel reinforcement is often added to create reinforced concrete (RC).',
    question: 'Why is steel reinforcement added to concrete?',
    options: [
      'To make it heavier',
      'To improve color',
      'Because concrete is weak in tension',
      'To save money',
    ],
    correctIndex: 2,
  },

  // ===== Business / TOEIC-style =====
  {
    id: 18,
    topic: 'business',
    question: 'Please send me the report _____ Friday.',
    options: ['until', 'by', 'for', 'in'],
    correctIndex: 1,
    explanation: '"By + deadline" = chậm nhất là.',
  },
  {
    id: 19,
    topic: 'business',
    question: 'The meeting has been _____ to next Monday.',
    options: ['postponed', 'put up', 'cancelled', 'happened'],
    correctIndex: 0,
    explanation: 'Postpone = hoãn lại.',
  },
  {
    id: 20,
    topic: 'business',
    question: 'We need to _____ the deadline by two weeks.',
    options: ['reduce', 'extend', 'shrink', 'cut'],
    correctIndex: 1,
  },
  {
    id: 21,
    topic: 'business',
    question: 'Our company has signed a contract _____ ABC Ltd.',
    options: ['by', 'with', 'for', 'in'],
    correctIndex: 1,
  },
  {
    id: 22,
    topic: 'business',
    question: 'The construction project is _____ schedule.',
    options: ['in', 'on', 'at', 'over'],
    correctIndex: 1,
    explanation: '"On schedule" = đúng tiến độ.',
  },
  {
    id: 23,
    topic: 'business',
    question: 'Could you please _____ a quotation for these materials?',
    options: ['provide', 'recieve', 'forget', 'refuse'],
    correctIndex: 0,
  },
];

export interface EnglishTopicConfig {
  topic: EnglishTopic;
  name: string;
  shortDesc: string;
  level: string;
  questionCount: number;
  passingScore: number;
  durationMin: number;
  color: string;
  icon: string;
}

export const ENGLISH_TOPIC_CONFIGS: Record<EnglishTopic, EnglishTopicConfig> = {
  grammar: {
    topic: 'grammar',
    name: 'Ngữ pháp',
    shortDesc: 'Tense, conditional, passive, comparative...',
    level: 'A2 → B1',
    questionCount: 7,
    passingScore: 5,
    durationMin: 15,
    color: '#3B82F6',
    icon: '📚',
  },
  vocab: {
    topic: 'vocab',
    name: 'Từ vựng',
    shortDesc: 'Synonym, antonym, từ vựng kỹ thuật xây dựng',
    level: 'A2 → B2',
    questionCount: 6,
    passingScore: 4,
    durationMin: 12,
    color: '#10B981',
    icon: '📖',
  },
  reading: {
    topic: 'reading',
    name: 'Đọc hiểu',
    shortDesc: 'Đoạn văn kỹ thuật + Q&A theo nội dung',
    level: 'B1 → B2',
    questionCount: 4,
    passingScore: 3,
    durationMin: 10,
    color: '#F59E0B',
    icon: '📰',
  },
  business: {
    topic: 'business',
    name: 'Business / TOEIC',
    shortDesc: 'Email, hợp đồng, deadline, thuật ngữ thương mại',
    level: 'B1 → B2',
    questionCount: 6,
    passingScore: 4,
    durationMin: 15,
    color: '#A855F7',
    icon: '💼',
  },
};

export function getEnglishQuestionsByTopic(t: EnglishTopic): EnglishQuestion[] {
  return ENGLISH_QUESTIONS.filter((q) => q.topic === t);
}

export function buildEnglishExam(t: EnglishTopic): EnglishQuestion[] {
  const all = getEnglishQuestionsByTopic(t);
  const cfg = ENGLISH_TOPIC_CONFIGS[t];
  const target = Math.min(cfg.questionCount, all.length);
  return [...all].sort(() => Math.random() - 0.5).slice(0, target);
}

export interface EnglishExamResult {
  total: number;
  correctCount: number;
  passingScore: number;
  passed: boolean;
  details: {
    question: EnglishQuestion;
    selectedIndex: number | null;
    isCorrect: boolean;
  }[];
}

export function evaluateEnglishExam(
  t: EnglishTopic,
  questions: EnglishQuestion[],
  answers: (number | null)[],
): EnglishExamResult {
  const cfg = ENGLISH_TOPIC_CONFIGS[t];
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
