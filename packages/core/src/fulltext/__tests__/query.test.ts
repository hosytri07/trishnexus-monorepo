import { describe, expect, it } from 'vitest';
import { parseQuery } from '../query.js';

describe('parseQuery', () => {
  it('returns empty clauses for blank query', () => {
    expect(parseQuery('').clauses).toHaveLength(0);
    expect(parseQuery('   ').clauses).toHaveLength(0);
  });

  it('parses a single word', () => {
    const q = parseQuery('react');
    expect(q.clauses).toHaveLength(1);
    expect(q.clauses[0]?.term).toBe('react');
    expect(q.clauses[0]?.negate).toBe(false);
    expect(q.clauses[0]?.prefix).toBe(false);
    expect(q.clauses[0]?.phrase).toBe(false);
  });

  it('parses multi word as AND clauses', () => {
    const q = parseQuery('react hook');
    expect(q.clauses).toHaveLength(2);
    expect(q.clauses[0]?.term).toBe('react');
    expect(q.clauses[1]?.term).toBe('hook');
  });

  it('detects negate prefix -', () => {
    const q = parseQuery('react -legacy');
    expect(q.clauses[1]?.negate).toBe(true);
    expect(q.clauses[1]?.term).toBe('legacy');
  });

  it('detects prefix * suffix', () => {
    const q = parseQuery('typ*');
    expect(q.clauses[0]?.prefix).toBe(true);
    expect(q.clauses[0]?.term).toBe('typ');
  });

  it('parses quoted phrase', () => {
    const q = parseQuery('"hello world"');
    expect(q.clauses[0]?.phrase).toBe(true);
    expect(q.clauses[0]?.term).toContain('hello');
    expect(q.clauses[0]?.term).toContain('world');
  });

  it('parses source filter prefix', () => {
    const q = parseQuery('note:todo');
    expect(q.sourceFilter).toBe('note');
    expect(q.clauses[0]?.term).toBe('todo');
    expect(q.clauses[0]?.source).toBe('note');
  });

  it('ignores unknown source prefix as regular token', () => {
    const q = parseQuery('foo:bar');
    // "foo:bar" → not a source, whole token tokenized → tokenize drops colon
    expect(q.sourceFilter).toBeNull();
  });

  it('handles combination: source + negate + prefix', () => {
    const q = parseQuery('library:react -legacy typ*');
    expect(q.sourceFilter).toBe('library');
    expect(q.clauses.length).toBe(3);
  });
});
