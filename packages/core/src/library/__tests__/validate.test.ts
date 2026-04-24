import { describe, expect, it } from 'vitest';
import { validateDraft } from '../validate.js';

describe('validateDraft', () => {
  it('accepts minimal valid draft', () => {
    const r = validateDraft({ path: '/x/a.pdf' });
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
    expect(r.normalizedTags).toEqual([]);
  });

  it('requires path', () => {
    const r = validateDraft({ path: '' });
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toMatch(/đường dẫn/);
  });

  it('rejects too long title', () => {
    const r = validateDraft({ path: '/x/a.pdf', title: 'x'.repeat(400) });
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toMatch(/Tiêu đề/);
  });

  it('rejects invalid year', () => {
    const r = validateDraft({ path: '/x/a.pdf', year: -5 });
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toMatch(/Năm/);
  });

  it('rejects invalid status', () => {
    // @ts-expect-error — intentionally wrong type
    const r = validateDraft({ path: '/x/a.pdf', status: 'pausing' });
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toMatch(/Trạng thái/);
  });

  it('normalizes + dedupes tags', () => {
    const r = validateDraft({
      path: '/x/a.pdf',
      tags: [' TCVN ', 'tcvn', 'Xây Dựng', '-foo-', ''],
    });
    expect(r.ok).toBe(true);
    expect(r.normalizedTags).toEqual(['tcvn', 'xây dựng', 'foo']);
  });

  it('rejects too many tags', () => {
    const tags = Array.from({ length: 40 }, (_, i) => `t${i}`);
    const r = validateDraft({ path: '/x/a.pdf', tags });
    expect(r.ok).toBe(false);
  });
});
