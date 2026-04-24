import type {
  FontCollection,
  FontFamily,
  FontMeta,
  FontPair,
  FontPersonality,
} from './types.js';
import { classifyPersonality } from './classify.js';

/**
 * Nhóm FontMeta[] → FontFamily[]. Mỗi family aggregate mọi style
 * (Regular, Bold, Italic, ...). Personality được classify từ style
 * đầu tiên (thường là Regular); nếu không có Regular thì pick style
 * có weight gần 400 nhất.
 */
export function buildCollection(metas: FontMeta[]): FontCollection {
  const byFamily = new Map<string, FontMeta[]>();
  for (const m of metas) {
    const key = m.family.trim() || m.postscript_name;
    if (!byFamily.has(key)) byFamily.set(key, []);
    byFamily.get(key)!.push(m);
  }

  const families: FontFamily[] = [];
  let total_size_bytes = 0;
  for (const [family, styles] of byFamily) {
    // Pick representative style — ưu tiên Regular (weight 400, no italic).
    const rep = pickRepresentative(styles);
    const personality = classifyPersonality(rep);
    const weights = styles.map((s) => s.weight);
    const weight_min = Math.min(...weights);
    const weight_max = Math.max(...weights);
    const has_italic = styles.some((s) => s.italic);
    const vn_support = styles.some((s) => s.vn_support);
    for (const s of styles) total_size_bytes += s.size_bytes;

    families.push({
      family,
      personality,
      vn_support,
      styles,
      weight_min,
      weight_max,
      has_italic,
    });
  }

  // Sort by family name — stable UX across scans.
  families.sort((a, b) => a.family.localeCompare(b.family));

  return {
    families,
    total_files: metas.length,
    total_size_bytes,
  };
}

function pickRepresentative(styles: FontMeta[]): FontMeta {
  const regular = styles.find(
    (s) => s.weight === 400 && !s.italic && !/italic/i.test(s.subfamily),
  );
  if (regular) return regular;
  // Fallback: weight gần 400 nhất, không italic.
  const nonItalic = styles.filter((s) => !s.italic);
  const pool = nonItalic.length > 0 ? nonItalic : styles;
  return pool.reduce((best, s) =>
    Math.abs(s.weight - 400) < Math.abs(best.weight - 400) ? s : best,
  );
}

/**
 * Matrix contrast giữa 2 personality. Cao = pair tốt.
 * Dựa trên design heuristic:
 *   - serif + sans = classic editorial (max contrast giữa 2 cùng level readability)
 *   - sans + slab = kỹ thuật/tech feel
 *   - display + sans = poster-style
 *   - cùng personality = boring, trừ khi weight contrast đủ cao
 *   - script/handwriting chỉ hợp làm display + sans body
 */
const PERSONALITY_PAIR_MATRIX: Record<
  FontPersonality,
  Partial<Record<FontPersonality, number>>
> = {
  serif: { sans: 0.9, slab: 0.55, mono: 0.35, display: 0.45, serif: 0.25 },
  sans: { serif: 0.9, slab: 0.75, mono: 0.45, display: 0.7, sans: 0.25 },
  slab: { sans: 0.75, serif: 0.55, mono: 0.3, display: 0.5, slab: 0.2 },
  mono: { sans: 0.45, serif: 0.35, slab: 0.3, mono: 0.15 },
  display: { sans: 0.9, serif: 0.75, slab: 0.55, mono: 0.3, display: 0.1 },
  script: { sans: 0.85, serif: 0.65, slab: 0.45 },
  handwriting: { sans: 0.8, serif: 0.55 },
  unknown: { sans: 0.3, serif: 0.3 },
};

/**
 * Score 1 cặp [heading, body] trong range [0, 100].
 * Điểm dựa trên:
 *   - contrast personality (matrix) — trọng số 60
 *   - contrast weight (heading thường nặng hơn body) — 20
 *   - VN support của body (bắt buộc nếu cả 2 hỗ trợ càng tốt) — 20
 *
 * Ngoại lệ: cùng family → score 0 (không pair với chính mình).
 */
export function scorePair(heading: FontFamily, body: FontFamily): FontPair {
  if (heading.family === body.family) {
    return {
      heading,
      body,
      score: 0,
      contrast: 0,
      rationale: 'Không pair font với chính nó.',
    };
  }

  const matrix = PERSONALITY_PAIR_MATRIX[heading.personality] ?? {};
  const contrast = matrix[body.personality] ?? 0.2;
  const personalityScore = contrast * 60;

  // Heading nên có style đậm (500+), body nên có style vừa (300-500).
  const headingBold = heading.weight_max >= 600 ? 1 : heading.weight_max >= 500 ? 0.6 : 0.3;
  const bodyReadable =
    body.weight_min <= 400 && body.weight_max >= 400 ? 1 : 0.5;
  const weightScore = (headingBold * 0.5 + bodyReadable * 0.5) * 20;

  const vnScore = body.vn_support ? (heading.vn_support ? 20 : 12) : 0;

  const raw = personalityScore + weightScore + vnScore;
  const score = Math.max(0, Math.min(100, Math.round(raw)));

  return {
    heading,
    body,
    score,
    contrast,
    rationale: buildRationale(heading, body, contrast),
  };
}

function buildRationale(
  heading: FontFamily,
  body: FontFamily,
  contrast: number,
): string {
  const parts: string[] = [];
  if (contrast >= 0.85) {
    parts.push(
      `Cặp ${labelPersonality(heading.personality)} + ${labelPersonality(
        body.personality,
      )} có contrast cao, dễ đọc và chuyên nghiệp.`,
    );
  } else if (contrast >= 0.6) {
    parts.push(
      `Cặp ${labelPersonality(heading.personality)} + ${labelPersonality(
        body.personality,
      )} khá hợp.`,
    );
  } else if (contrast >= 0.3) {
    parts.push(
      `Cặp ${labelPersonality(heading.personality)} + ${labelPersonality(
        body.personality,
      )} tạm được, nên cân nhắc tăng contrast weight.`,
    );
  } else {
    parts.push(
      `Cặp này có contrast thấp — text có thể thiếu layer rõ ràng.`,
    );
  }

  if (!body.vn_support) {
    parts.push('Body chưa hỗ trợ tiếng Việt đầy đủ.');
  }
  if (heading.weight_max < 500) {
    parts.push('Heading thiếu style đậm — tiêu đề dễ chìm.');
  }

  return parts.join(' ');
}

function labelPersonality(p: FontPersonality): string {
  switch (p) {
    case 'serif':
      return 'Serif';
    case 'sans':
      return 'Sans-serif';
    case 'slab':
      return 'Slab serif';
    case 'mono':
      return 'Monospace';
    case 'display':
      return 'Display';
    case 'script':
      return 'Script';
    case 'handwriting':
      return 'Handwriting';
    case 'unknown':
      return 'Không rõ';
  }
}

export interface RecommendOptions {
  /** Số pair trả về tối đa. Default 10. */
  limit?: number;
  /** Chỉ xét family hỗ trợ tiếng Việt (body). Default false. */
  requireVnBody?: boolean;
  /** Pair cụ thể: chỉ định heading family, tìm body hợp nhất. */
  fixHeading?: string;
}

/**
 * Generate ranked pair recommendations từ collection. O(n²) — chấp
 * nhận được vì user collection thường < vài trăm family.
 */
export function recommendPairs(
  collection: FontCollection,
  opts: RecommendOptions = {},
): FontPair[] {
  const { limit = 10, requireVnBody = false, fixHeading } = opts;
  const fam = collection.families;

  const headings = fixHeading
    ? fam.filter((f) => f.family === fixHeading)
    : fam;
  const bodies = requireVnBody ? fam.filter((f) => f.vn_support) : fam;

  const pairs: FontPair[] = [];
  for (const h of headings) {
    for (const b of bodies) {
      if (h.family === b.family) continue;
      pairs.push(scorePair(h, b));
    }
  }

  pairs.sort((a, b) => b.score - a.score);
  return pairs.slice(0, limit);
}
