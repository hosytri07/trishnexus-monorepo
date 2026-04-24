/**
 * Cite generator — APA 7 + IEEE format cho LibraryDoc.
 *
 * Chỉ dùng metadata đã có trong doc (authors/year/title/publisher).
 * Không fetch network. Consumer có thể copy-paste vào bài viết.
 */

import type { LibraryDoc } from './types.js';

export type CiteStyle = 'apa' | 'ieee';

export const CITE_STYLES: readonly CiteStyle[] = ['apa', 'ieee'] as const;

export function citeStyleLabel(style: CiteStyle): string {
  switch (style) {
    case 'apa':
      return 'APA 7';
    case 'ieee':
      return 'IEEE';
  }
}

/**
 * Format tên kiểu APA: "Nguyen, V. A." — Last, F. M.
 * Tách theo whitespace cuối; ký tự đầu của phần còn lại → initial.
 *
 * Các tên VN viết "Họ Đệm Tên" → Last = "Nguyen", rest = initials
 *   → "Nguyen, V. A." (acceptable approximation).
 */
export function formatAuthorApa(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0]!;
  const last = parts[0]!;
  const rest = parts.slice(1);
  const initials = rest
    .map((p) => p[0]!.toUpperCase() + '.')
    .join(' ');
  return `${last}, ${initials}`;
}

/**
 * IEEE style: "V. A. Nguyen" — initials + last.
 */
export function formatAuthorIeee(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0]!;
  const last = parts[0]!;
  const rest = parts.slice(1);
  const initials = rest
    .map((p) => p[0]!.toUpperCase() + '.')
    .join(' ');
  return `${initials} ${last}`;
}

/**
 * Join authors list theo APA rule: `A`, `A & B`, `A, B, & C`, … `A et al.` nếu >7.
 */
function joinAuthorsApa(authors: string[]): string {
  if (authors.length === 0) return '';
  if (authors.length === 1) return authors[0]!;
  if (authors.length === 2) return `${authors[0]} & ${authors[1]}`;
  if (authors.length <= 7) {
    return authors.slice(0, -1).join(', ') + ', & ' + authors[authors.length - 1];
  }
  // >7 authors — first 6 + "..." + last
  return (
    authors.slice(0, 6).join(', ') +
    ', ... ' +
    authors[authors.length - 1]
  );
}

/**
 * IEEE: comma list + "and" trước tên cuối, nhiều tác giả dùng "et al.".
 */
function joinAuthorsIeee(authors: string[]): string {
  if (authors.length === 0) return '';
  if (authors.length === 1) return authors[0]!;
  if (authors.length > 6) return `${authors[0]} et al.`;
  if (authors.length === 2) return `${authors[0]} and ${authors[1]}`;
  return authors.slice(0, -1).join(', ') + ', and ' + authors[authors.length - 1];
}

/**
 * Generate citation string. Fallback gracefully khi thiếu field —
 * không throw.
 */
export function formatCitation(doc: LibraryDoc, style: CiteStyle): string {
  const title = doc.title.trim() || doc.name;
  const year = doc.year != null && Number.isFinite(doc.year) ? `${doc.year}` : 'n.d.';
  const publisher = doc.publisher?.trim() || null;

  if (style === 'apa') {
    const authors = doc.authors.map(formatAuthorApa).filter(Boolean);
    const authorStr = joinAuthorsApa(authors);
    const parts: string[] = [];
    if (authorStr) parts.push(`${authorStr} (${year}).`);
    else parts.push(`(${year}).`);
    // Italicize title in rendered output, nhưng string plaintext dùng ngoặc kép.
    parts.push(`${title}.`);
    if (publisher) parts.push(`${publisher}.`);
    return parts.join(' ').trim();
  }

  // IEEE
  const authors = doc.authors.map(formatAuthorIeee).filter(Boolean);
  const authorStr = joinAuthorsIeee(authors);
  const segments: string[] = [];
  if (authorStr) segments.push(authorStr + ',');
  segments.push(`"${title},"`);
  if (publisher) segments.push(`${publisher},`);
  segments.push(`${year}.`);
  return segments.join(' ').trim();
}

/**
 * Tạo bundle nhiều citation (cho user xuất cả danh sách).
 * IEEE đánh số [1], [2], ... ; APA sort alphabet theo author đầu.
 */
export function formatCitationList(
  docs: readonly LibraryDoc[],
  style: CiteStyle,
): string[] {
  if (style === 'apa') {
    const entries = docs.map((d) => ({
      doc: d,
      firstAuthor: d.authors[0]?.trim().toLowerCase() || d.title.toLowerCase(),
    }));
    entries.sort((a, b) => a.firstAuthor.localeCompare(b.firstAuthor, 'en'));
    return entries.map((e) => formatCitation(e.doc, 'apa'));
  }
  return docs.map((d, i) => `[${i + 1}] ${formatCitation(d, 'ieee')}`);
}
