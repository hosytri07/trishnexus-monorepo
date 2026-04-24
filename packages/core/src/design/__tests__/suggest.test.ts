import { describe, expect, it } from 'vitest';
import { suggestPalette } from '../suggest.js';
import { validateTokenSet } from '../tokens.js';

describe('suggestPalette', () => {
  it('light mode returns valid set', () => {
    const { set, notes } = suggestPalette('#F59E0B', 'light');
    expect(set.scales.length).toBeGreaterThan(3);
    expect(set.scales.find((s) => s.name === 'primary')).toBeDefined();
    expect(set.scales.find((s) => s.name === 'secondary')).toBeDefined();
    expect(set.scales.find((s) => s.name === 'accent')).toBeDefined();
    expect(set.scales.find((s) => s.name === 'neutral')).toBeDefined();
    expect(set.semantic).toBeDefined();
    expect(notes.length).toBeGreaterThan(0);
    // No validation error
    const errors = validateTokenSet(set).filter((i) => i.severity === 'error');
    expect(errors).toHaveLength(0);
  });
  it('dark mode uses neutral.950 as bg', () => {
    const { set } = suggestPalette('#2E75B6', 'dark');
    expect(set.semantic?.background).toBe('neutral.950');
  });
  it('light mode uses neutral.50 as bg', () => {
    const { set } = suggestPalette('#2E75B6', 'light');
    expect(set.semantic?.background).toBe('neutral.50');
  });
  it('includes success/warning/danger scales', () => {
    const { set } = suggestPalette('#F59E0B', 'brand');
    expect(set.scales.find((s) => s.name === 'success')).toBeDefined();
    expect(set.scales.find((s) => s.name === 'warning')).toBeDefined();
    expect(set.scales.find((s) => s.name === 'danger')).toBeDefined();
  });
  it('emits harmony note', () => {
    const { notes } = suggestPalette('#F59E0B', 'light');
    expect(notes.some((n) => n.toLowerCase().includes('harmony'))).toBe(true);
  });
  it('handles lowercase hex without #', () => {
    const { set } = suggestPalette('f59e0b', 'light');
    expect(set.scales[0]?.base).toBe('#F59E0B');
  });
});
