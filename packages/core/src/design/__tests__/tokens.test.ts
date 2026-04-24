import { describe, expect, it } from 'vitest';
import { buildScale } from '../scale.js';
import {
  createEmptyTokenSet,
  mergeTokenSets,
  resolveSemantic,
  validateTokenSet,
} from '../tokens.js';

describe('createEmptyTokenSet', () => {
  it('creates defaults', () => {
    const scale = buildScale('primary', '#F59E0B');
    const set = createEmptyTokenSet('my-id', 'My Set', scale);
    expect(set.id).toBe('my-id');
    expect(set.name).toBe('My Set');
    expect(set.scales).toHaveLength(1);
    expect(set.spacing).toHaveProperty('4');
    expect(set.radius).toHaveProperty('md');
    expect(set.shadow).toHaveProperty('md');
    expect(set.typography?.body).toBeDefined();
    expect(set.createdAt).toBeGreaterThan(0);
  });
});

describe('validateTokenSet', () => {
  it('empty id → error', () => {
    const scale = buildScale('primary', '#F59E0B');
    const set = createEmptyTokenSet('', 'Name', scale);
    const issues = validateTokenSet(set);
    expect(issues.some((i) => i.path === 'id' && i.severity === 'error')).toBe(
      true,
    );
  });
  it('empty name → error', () => {
    const scale = buildScale('primary', '#F59E0B');
    const set = createEmptyTokenSet('id', '', scale);
    expect(
      validateTokenSet(set).some((i) => i.path === 'name'),
    ).toBe(true);
  });
  it('semantic referencing unknown scale → warn', () => {
    const scale = buildScale('primary', '#F59E0B');
    const set = createEmptyTokenSet('id', 'Name', scale);
    set.semantic = { danger: 'unknown.500' };
    const issues = validateTokenSet(set);
    expect(
      issues.find((i) => i.path === 'semantic["danger"]' && i.severity === 'warn'),
    ).toBeDefined();
  });
  it('semantic hex accepted', () => {
    const scale = buildScale('primary', '#F59E0B');
    const set = createEmptyTokenSet('id', 'Name', scale);
    set.semantic = { danger: '#FF0000' };
    const errors = validateTokenSet(set).filter((i) => i.severity === 'error');
    expect(errors).toHaveLength(0);
  });
  it('clean set → no issues', () => {
    const scale = buildScale('primary', '#F59E0B');
    const set = createEmptyTokenSet('id', 'Name', scale);
    expect(validateTokenSet(set)).toHaveLength(0);
  });
});

describe('resolveSemantic', () => {
  it('resolves scale.key', () => {
    const scale = buildScale('primary', '#F59E0B');
    const set = createEmptyTokenSet('id', 'Name', scale);
    set.semantic = { btn: 'primary.500' };
    const hex = resolveSemantic(set, 'btn');
    expect(hex).toMatch(/^#[0-9A-F]{6}$/);
  });
  it('resolves hex directly', () => {
    const scale = buildScale('primary', '#F59E0B');
    const set = createEmptyTokenSet('id', 'Name', scale);
    set.semantic = { btn: '#123abc' };
    expect(resolveSemantic(set, 'btn')).toBe('#123ABC');
  });
  it('returns null for missing alias', () => {
    const scale = buildScale('primary', '#F59E0B');
    const set = createEmptyTokenSet('id', 'Name', scale);
    expect(resolveSemantic(set, 'nope')).toBeNull();
  });
});

describe('mergeTokenSets', () => {
  it('adds new scale', () => {
    const a = createEmptyTokenSet('a', 'A', buildScale('primary', '#F59E0B'));
    const merged = mergeTokenSets(a, {
      scales: [buildScale('accent', '#2E75B6')],
    });
    expect(merged.scales.map((s) => s.name).sort()).toEqual([
      'accent',
      'primary',
    ]);
  });
  it('replaces same-name scale', () => {
    const a = createEmptyTokenSet('a', 'A', buildScale('primary', '#F59E0B'));
    const newPrimary = buildScale('primary', '#FF0000');
    const merged = mergeTokenSets(a, { scales: [newPrimary] });
    expect(merged.scales).toHaveLength(1);
    expect(merged.scales[0]?.base).toBe('#FF0000');
  });
  it('merges semantic keys', () => {
    const a = createEmptyTokenSet('a', 'A', buildScale('primary', '#F59E0B'));
    a.semantic = { btn: 'primary.500' };
    const merged = mergeTokenSets(a, { semantic: { danger: '#FF0000' } });
    expect(merged.semantic?.btn).toBe('primary.500');
    expect(merged.semantic?.danger).toBe('#FF0000');
  });
});
