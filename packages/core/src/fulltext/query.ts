/**
 * Query parser — mini DSL cho TrishSearch.
 *
 * Hỗ trợ:
 *   - Token đơn: `react` → AND clause
 *   - Phrase: `"hello world"` → phrase match
 *   - Negate: `-draft` → exclude doc có chứa "draft"
 *   - Prefix: `typ*` → match startsWith "typ"
 *   - Source filter: `note:todo` hoặc `library:book` → lọc source
 *
 * Không hỗ trợ OR explicit (keep simple) — tất cả clause AND với nhau.
 */

import type { FulltextSource, ParsedQuery, QueryClause } from './types.js';
import { FULLTEXT_SOURCES } from './types.js';
import { tokenizeQuery } from './tokenize.js';

/**
 * Parse query text thành `ParsedQuery`. Trả về clauses rỗng nếu query
 * toàn space / stopword — caller nên handle empty = show all.
 */
export function parseQuery(raw: string): ParsedQuery {
  const clauses: QueryClause[] = [];
  let sourceFilter: FulltextSource | null = null;
  if (!raw || !raw.trim()) return { clauses, sourceFilter };

  // Tokenize bằng regex handle quote + prefix + negate.
  const re = /"([^"]+)"|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    const rawToken = m[1] ?? m[2];
    if (!rawToken) continue;
    let token = rawToken;
    const negate = token.startsWith('-');
    if (negate) token = token.slice(1);
    // Source filter: `note:xyz` → source=note + clause term=xyz
    let localSource: FulltextSource | null = null;
    const colonIdx = token.indexOf(':');
    if (colonIdx > 0) {
      const prefix = token.slice(0, colonIdx).toLowerCase();
      if (isSource(prefix)) {
        localSource = prefix as FulltextSource;
        token = token.slice(colonIdx + 1);
        // Set global sourceFilter theo clause đầu tiên — clause sau đè
        // cũng OK, UX không phức tạp.
        sourceFilter = localSource;
      }
    }
    const prefix = token.endsWith('*');
    if (prefix) token = token.slice(0, -1);
    // Phrase: rawToken đến từ quoted
    const phrase = m[1] !== undefined;
    const normalized = tokenizeQuery(token).join(' ');
    if (!normalized) continue;
    clauses.push({
      term: normalized,
      phrase,
      negate,
      prefix,
      source: localSource,
    });
  }

  return { clauses, sourceFilter };
}

function isSource(s: string): boolean {
  return (FULLTEXT_SOURCES as readonly string[]).includes(s);
}
