/**
 * Tokenize cho BM25 index — fold tiếng Việt + stopword + stem nhẹ.
 *
 * Tái dùng `foldVietnamese` từ `../search/fold.ts` nhưng thêm:
 *   - Stopword list VN + EN (bỏ những từ noise như "là" / "the")
 *   - Stem nhẹ (bỏ `-s` / `-ing` / `-ed` phía sau, không aggressive)
 *   - Giữ vị trí token để highlight snippet
 */

import { foldVietnamese } from '../search/fold.js';

/**
 * Stopword list — rút gọn, chỉ chặn noise rõ ràng. Không chặn "không" /
 * "có" vì người dùng thường search "không được" / "có thể".
 */
export const STOPWORDS: ReadonlySet<string> = new Set([
  // EN
  'a',
  'an',
  'the',
  'of',
  'in',
  'on',
  'at',
  'to',
  'for',
  'and',
  'or',
  'but',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'this',
  'that',
  'these',
  'those',
  'it',
  'its',
  'with',
  'from',
  'as',
  'by',
  // VN (đã fold)
  'la',
  'va',
  'cua',
  'cho',
  'voi',
  'thi',
  'ma',
  'nhung',
  'neu',
  'roi',
  'den',
  'tu',
  'tai',
  've',
  'nay',
  'do',
  'kia',
  'ay',
  'de',
]);

/**
 * Stem nhẹ: bỏ suffix common EN và VN khi token >=4 char. Không làm Porter
 * full — chỉ normalize plural / gerund phổ biến.
 */
export function stem(token: string): string {
  if (token.length < 4) return token;
  // EN plural / verb forms
  if (token.endsWith('ing') && token.length >= 5) return token.slice(0, -3);
  if (token.endsWith('ed') && token.length >= 4) return token.slice(0, -2);
  if (token.endsWith('ies') && token.length >= 5)
    return token.slice(0, -3) + 'y';
  if (token.endsWith('es') && token.length >= 4) return token.slice(0, -2);
  if (token.endsWith('s') && !token.endsWith('ss')) return token.slice(0, -1);
  return token;
}

/**
 * Tokenize cho indexing — giữ vị trí, fold dấu, bỏ stopword, stem nhẹ.
 *
 * Trả về mảng `[token, position]` để caller biết token thứ i nằm ở đâu
 * (dùng cho snippet highlight).
 */
export function tokenizePositions(
  input: string,
): Array<{ token: string; pos: number }> {
  if (!input) return [];
  const folded = foldVietnamese(input);
  const out: Array<{ token: string; pos: number }> = [];
  const re = /[a-z0-9]+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(folded)) !== null) {
    const raw = m[0];
    if (raw.length < 2) continue;
    if (STOPWORDS.has(raw)) continue;
    const stemmed = stem(raw);
    if (stemmed.length < 2) continue;
    out.push({ token: stemmed, pos: m.index });
  }
  return out;
}

/**
 * Tokenize đơn giản — chỉ trả về token list. Tương đương `tokenize` cũ
 * trong `../search/fold.ts` nhưng có thêm stopword + stem.
 */
export function tokenizeFull(input: string): string[] {
  return tokenizePositions(input).map((t) => t.token);
}

/**
 * Normalize 1 chuỗi query ngắn thành token (không stem, để phrase match
 * chính xác). Dùng cho user query — người dùng gõ "handbook" thì match
 * đúng từ gốc, không stem thành "handbook" (vì stem 's' bỏ đi).
 *
 * Tuy nhiên có stem nhẹ cho cả query để khớp với doc (doc cũng stem).
 */
export function tokenizeQuery(input: string): string[] {
  return tokenizePositions(input).map((t) => t.token);
}
