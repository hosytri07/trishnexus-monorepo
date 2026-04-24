import { describe, expect, it } from 'vitest';
import { STOPWORDS, stem, tokenizeFull, tokenizePositions } from '../tokenize.js';

describe('stem', () => {
  it('leaves short tokens untouched', () => {
    expect(stem('go')).toBe('go');
    expect(stem('app')).toBe('app');
  });

  it('strips -ing for >=5 char tokens', () => {
    expect(stem('running')).toBe('runn');
    expect(stem('coding')).toBe('cod');
  });

  it('strips -ed for >=4 char tokens', () => {
    expect(stem('coded')).toBe('cod');
  });

  it('handles -ies → -y plural', () => {
    expect(stem('libraries')).toBe('library');
    expect(stem('cities')).toBe('city');
  });

  it('strips trailing -s but not -ss', () => {
    expect(stem('docs')).toBe('doc');
    expect(stem('class')).toBe('class');
  });
});

describe('tokenizePositions', () => {
  it('returns empty array for empty input', () => {
    expect(tokenizePositions('')).toEqual([]);
    expect(tokenizePositions('   ')).toEqual([]);
  });

  it('folds Vietnamese diacritics', () => {
    const toks = tokenizeFull('Số phận tiếng Việt');
    // "so" stopword-removed? no, "so" not in stopwords. 'phan' > stem > 'phan'.
    expect(toks).toContain('phan');
    expect(toks).toContain('tieng');
    expect(toks).toContain('viet');
  });

  it('drops stopwords', () => {
    const toks = tokenizeFull('The quick brown fox');
    expect(toks).not.toContain('the');
    expect(toks).toContain('quick');
    expect(toks).toContain('brown');
    expect(toks).toContain('fox');
  });

  it('tracks position for snippet building', () => {
    const pos = tokenizePositions('hello world');
    expect(pos[0]?.token).toBe('hello');
    expect(pos[0]?.pos).toBe(0);
    expect(pos[1]?.token).toBe('world');
    expect(pos[1]?.pos).toBe(6);
  });

  it('skips tokens shorter than 2 chars', () => {
    const toks = tokenizeFull('a b c hi ok');
    expect(toks).toContain('hi');
    expect(toks).toContain('ok');
    expect(toks).not.toContain('a');
  });

  it('stems plural/gerund for indexing', () => {
    const toks = tokenizeFull('running coders');
    expect(toks).toContain('runn');
    expect(toks).toContain('coder');
  });
});

describe('STOPWORDS', () => {
  it('contains common VN stopwords (folded)', () => {
    expect(STOPWORDS.has('la')).toBe(true);
    expect(STOPWORDS.has('va')).toBe(true);
  });

  it('contains common EN stopwords', () => {
    expect(STOPWORDS.has('the')).toBe(true);
    expect(STOPWORDS.has('and')).toBe(true);
  });
});
