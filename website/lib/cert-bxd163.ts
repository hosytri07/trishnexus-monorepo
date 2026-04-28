/**
 * lib/cert-bxd163.ts — Phase 19.21.
 *
 * Loader cho ngân hàng câu hỏi sát hạch chứng chỉ hành nghề xây dựng
 * theo QĐ 163/QĐ-BXD ngày 18/02/2025. Tổng 8,081 câu, 16 chuyên ngành,
 * 3 hạng (I/II/III), 3 chuyên đề (Chuyên môn / Pháp luật chung / Pháp luật riêng).
 *
 * Dữ liệu lazy fetch từ /public/cert-bxd163.json (~3.7 MB).
 */

export type CertClass = 'I' | 'II' | 'III';
export type CertCategory = 'cm' | 'plc' | 'plr'; // chuyên môn / pháp luật chung / pháp luật riêng

export interface BxdQuestion {
  id: string;
  q: string;
  o: string[]; // 4 options [a, b, c, d]
  a: number; // 0-3 correct index
  cls: CertClass;
  cat: CertCategory;
}

export interface BxdTopic {
  code: string;
  name: string;
  questions: BxdQuestion[];
}

export interface BxdDataset {
  topics: Record<string, BxdTopic>; // slug -> topic
  meta: { source: string; total: number };
}

let _cache: BxdDataset | null = null;
let _inflight: Promise<BxdDataset> | null = null;

/** Lazy fetch ngân hàng câu hỏi. Cache trong session. */
export async function loadBxd163(): Promise<BxdDataset> {
  if (_cache) return _cache;
  if (_inflight) return _inflight;
  _inflight = fetch('/cert-bxd163.json', { cache: 'force-cache' })
    .then(async (r) => {
      if (!r.ok) throw new Error(`Fetch cert-bxd163.json failed: ${r.status}`);
      const data = (await r.json()) as BxdDataset;
      _cache = data;
      return data;
    })
    .finally(() => {
      _inflight = null;
    });
  return _inflight;
}

export const CATEGORY_LABEL: Record<CertCategory, string> = {
  cm: 'Chuyên môn',
  plc: 'Pháp luật chung',
  plr: 'Pháp luật riêng',
};

export const CATEGORY_COLOR: Record<CertCategory, string> = {
  cm: '#3B82F6',
  plc: '#10B981',
  plr: '#F59E0B',
};

export const CLASS_LABEL: Record<CertClass, string> = {
  I: 'Hạng I',
  II: 'Hạng II',
  III: 'Hạng III',
};

export const CLASS_DESC: Record<CertClass, string> = {
  I: 'Cao nhất — chủ trì thiết kế / giám sát công trình cấp I, II, III',
  II: 'Trung — chủ trì thiết kế / giám sát công trình cấp II, III',
  III: 'Cơ sở — chủ trì công trình cấp III, IV',
};

export interface BxdExamConfig {
  questionCount: number;
  passingScore: number;
  durationMin: number;
}

/** Cấu hình đề mặc định: 25 câu, đậu ≥ 18, 60 phút (theo Thông tư BXD). */
export const DEFAULT_EXAM_CONFIG: BxdExamConfig = {
  questionCount: 25,
  passingScore: 18,
  durationMin: 60,
};

/**
 * Build đề thi:
 *   - lọc theo class
 *   - blend đều giữa 3 chuyên đề (nếu có) sau đó shuffle
 *   - cắt theo questionCount
 */
export function buildExam(
  topic: BxdTopic,
  cls: CertClass,
  config: BxdExamConfig = DEFAULT_EXAM_CONFIG,
  /** Bộ chuyên đề muốn lấy. Mặc định: cả 3. */
  cats: CertCategory[] = ['cm', 'plc', 'plr'],
): BxdQuestion[] {
  const filtered = topic.questions.filter(
    (q) => q.cls === cls && cats.includes(q.cat),
  );
  // Pool size có thể nhỏ hơn config, lấy tối đa
  const target = Math.min(config.questionCount, filtered.length);
  // Sample đều theo cat (round-robin nếu đủ)
  const grouped: Record<CertCategory, BxdQuestion[]> = { cm: [], plc: [], plr: [] };
  for (const q of filtered) grouped[q.cat].push(q);
  for (const c of cats) shuffle(grouped[c]);

  const result: BxdQuestion[] = [];
  let i = 0;
  while (result.length < target) {
    const c = cats[i % cats.length]!;
    const pool = grouped[c];
    if (pool.length > 0) result.push(pool.pop()!);
    i++;
    // bail nếu tất cả pool đều rỗng
    if (cats.every((cc) => grouped[cc].length === 0)) break;
  }
  // Shuffle final order
  shuffle(result);
  return result;
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

export interface BxdExamResult {
  total: number;
  correctCount: number;
  passingScore: number;
  passed: boolean;
  details: {
    question: BxdQuestion;
    selectedIndex: number | null;
    isCorrect: boolean;
  }[];
}

export function evaluateExam(
  questions: BxdQuestion[],
  answers: (number | null)[],
  config: BxdExamConfig = DEFAULT_EXAM_CONFIG,
): BxdExamResult {
  let correctCount = 0;
  const details = questions.map((q, i) => {
    const sel = answers[i] ?? null;
    const ok = sel === q.a;
    if (ok) correctCount++;
    return { question: q, selectedIndex: sel, isCorrect: ok };
  });
  return {
    total: questions.length,
    correctCount,
    passingScore: config.passingScore,
    passed: correctCount >= config.passingScore,
    details,
  };
}

/** Group topics by chapter prefix (1 / 3 / 4) để render picker theo nhóm. */
export interface ChapterGroup {
  chapter: '1' | '3' | '4';
  name: string;
  icon: string;
  color: string;
  topics: BxdTopic[];
}

export function groupTopicsByChapter(dataset: BxdDataset): ChapterGroup[] {
  const groups: ChapterGroup[] = [
    { chapter: '1', name: 'Khảo sát xây dựng', icon: '🛰️', color: '#0EA5E9', topics: [] },
    { chapter: '3', name: 'Thiết kế xây dựng', icon: '📐', color: '#A855F7', topics: [] },
    { chapter: '4', name: 'Giám sát thi công', icon: '👁️', color: '#10B981', topics: [] },
  ];
  for (const slug of Object.keys(dataset.topics)) {
    const t = dataset.topics[slug]!;
    const ch = t.code.split('.')[0]!;
    const g = groups.find((x) => x.chapter === ch);
    if (g) g.topics.push(t);
  }
  // Sort each group by code numerically (3.10 after 3.9)
  for (const g of groups) {
    g.topics.sort((a, b) => {
      const na = a.code.split('.').map(Number);
      const nb = b.code.split('.').map(Number);
      return (na[0]! - nb[0]!) || (na[1]! - nb[1]!);
    });
  }
  return groups;
}
