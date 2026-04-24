import { describe, it, expect } from 'vitest';
import {
  validateDraft,
  normalizeTag,
  MAX_TITLE_LENGTH,
  MAX_BODY_LENGTH,
} from '../index.js';

describe('validateDraft', () => {
  it('note có nội dung → pass', () => {
    expect(
      validateDraft({ title: 'Hello', body: 'World', tags: [] }),
    ).toBeNull();
  });

  it('title + body rỗng → error', () => {
    expect(
      validateDraft({ title: '', body: '', tags: [] }),
    ).toBe('Ghi chú không được trống');
  });

  it('chỉ title có → pass', () => {
    expect(
      validateDraft({ title: 'Hello', body: '', tags: [] }),
    ).toBeNull();
  });

  it('chỉ whitespace → error', () => {
    expect(
      validateDraft({ title: '   ', body: '\n\t', tags: [] }),
    ).toBe('Ghi chú không được trống');
  });

  it('title quá dài → error', () => {
    const longTitle = 'a'.repeat(MAX_TITLE_LENGTH + 1);
    expect(
      validateDraft({ title: longTitle, body: 'x', tags: [] }),
    ).toContain('Tiêu đề vượt');
  });

  it('body quá dài → error', () => {
    const longBody = 'a'.repeat(MAX_BODY_LENGTH + 1);
    expect(
      validateDraft({ title: 't', body: longBody, tags: [] }),
    ).toContain('Nội dung vượt');
  });

  it('quá nhiều tag → error', () => {
    const manyTags = Array.from({ length: 21 }, (_, i) => `tag${i}`);
    expect(
      validateDraft({ title: 't', body: '', tags: manyTags }),
    ).toContain('Tối đa');
  });
});

describe('normalizeTag', () => {
  it('lowercase + trim + dash-join', () => {
    expect(normalizeTag('  Hello World  ')).toBe('hello-world');
  });

  it('multi-space → single dash', () => {
    expect(normalizeTag('quick    notes')).toBe('quick-notes');
  });
});
