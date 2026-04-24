/**
 * DesignTokenSet — gom palette + spacing + typography + shadow.
 *
 * Cung cấp: createEmptyTokenSet, validate, merge, semantic lookup.
 */

import type {
  ColorScale,
  DesignTokenSet,
  TokenValidationIssue,
} from './types.js';
import { normalizeHex } from './convert.js';
import { swatchByKey } from './scale.js';

/** Tạo 1 token set rỗng với scale primary tối thiểu. */
export function createEmptyTokenSet(
  id: string,
  name: string,
  primaryScale: ColorScale,
): DesignTokenSet {
  const now = Date.now();
  return {
    id,
    name,
    scales: [primaryScale],
    semantic: {},
    spacing: {
      '0': '0',
      '1': '0.25rem',
      '2': '0.5rem',
      '3': '0.75rem',
      '4': '1rem',
      '6': '1.5rem',
      '8': '2rem',
      '12': '3rem',
      '16': '4rem',
    },
    radius: {
      none: '0',
      sm: '0.125rem',
      md: '0.375rem',
      lg: '0.5rem',
      xl: '0.75rem',
      full: '9999px',
    },
    shadow: {
      sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
      md: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
      lg: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
    },
    typography: {
      body: {
        fontFamily: ['ui-sans-serif', 'system-ui'],
        fontSize: '14px',
        lineHeight: '1.5',
        fontWeight: 400,
        letterSpacing: '0',
      },
    },
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Validate token set — kiểm tra hex format, scale keys, semantic reference
 * hợp lệ. Trả về danh sách issue (error + warn), rỗng nếu pass.
 */
export function validateTokenSet(set: DesignTokenSet): TokenValidationIssue[] {
  const issues: TokenValidationIssue[] = [];
  if (!set.id.trim()) {
    issues.push({ path: 'id', message: 'id rỗng', severity: 'error' });
  }
  if (!set.name.trim()) {
    issues.push({ path: 'name', message: 'name rỗng', severity: 'error' });
  }
  if (set.scales.length === 0) {
    issues.push({
      path: 'scales',
      message: 'cần ít nhất 1 color scale',
      severity: 'error',
    });
  }
  for (let i = 0; i < set.scales.length; i++) {
    const scale = set.scales[i];
    if (!scale) continue;
    if (!scale.name.trim()) {
      issues.push({
        path: `scales[${i}].name`,
        message: 'scale thiếu tên',
        severity: 'error',
      });
    }
    try {
      normalizeHex(scale.base);
    } catch {
      issues.push({
        path: `scales[${i}].base`,
        message: `base "${scale.base}" không phải hex hợp lệ`,
        severity: 'error',
      });
    }
    for (let j = 0; j < scale.swatches.length; j++) {
      const sw = scale.swatches[j];
      if (!sw) continue;
      try {
        normalizeHex(sw.hex);
      } catch {
        issues.push({
          path: `scales[${i}].swatches[${j}].hex`,
          message: `hex "${sw.hex}" invalid`,
          severity: 'error',
        });
      }
    }
  }
  if (set.semantic) {
    for (const [alias, value] of Object.entries(set.semantic)) {
      // Value có thể là hex hoặc "scaleName.key".
      if (value.startsWith('#')) {
        try {
          normalizeHex(value);
        } catch {
          issues.push({
            path: `semantic["${alias}"]`,
            message: `hex "${value}" invalid`,
            severity: 'error',
          });
        }
      } else {
        const dot = value.indexOf('.');
        if (dot === -1) {
          issues.push({
            path: `semantic["${alias}"]`,
            message: `reference phải dạng "scaleName.key" hoặc hex`,
            severity: 'error',
          });
          continue;
        }
        const scaleName = value.slice(0, dot);
        const key = value.slice(dot + 1);
        const scale = set.scales.find((s) => s.name === scaleName);
        if (!scale) {
          issues.push({
            path: `semantic["${alias}"]`,
            message: `scale "${scaleName}" không tồn tại`,
            severity: 'warn',
          });
          continue;
        }
        if (!swatchByKey(scale, key)) {
          issues.push({
            path: `semantic["${alias}"]`,
            message: `key "${key}" không có trong scale "${scaleName}"`,
            severity: 'warn',
          });
        }
      }
    }
  }
  return issues;
}

/**
 * Resolve 1 semantic alias → hex cuối cùng. Trả null nếu không resolve được.
 */
export function resolveSemantic(
  set: DesignTokenSet,
  alias: string,
): string | null {
  const v = set.semantic?.[alias];
  if (!v) return null;
  if (v.startsWith('#')) return v.toUpperCase();
  const dot = v.indexOf('.');
  if (dot === -1) return null;
  const scaleName = v.slice(0, dot);
  const key = v.slice(dot + 1);
  const scale = set.scales.find((s) => s.name === scaleName);
  if (!scale) return null;
  const sw = swatchByKey(scale, key);
  return sw ? sw.hex : null;
}

/**
 * Merge 2 token set — b ghi đè lên a. Mảng scale: b bổ sung scale mới, thay
 * thế scale cùng tên. Semantic/spacing/… merge plain object.
 */
export function mergeTokenSets(
  a: DesignTokenSet,
  b: Partial<DesignTokenSet>,
): DesignTokenSet {
  const scalesMap = new Map<string, ColorScale>();
  for (const s of a.scales) scalesMap.set(s.name, s);
  if (b.scales) {
    for (const s of b.scales) scalesMap.set(s.name, s);
  }
  return {
    ...a,
    name: b.name ?? a.name,
    description: b.description ?? a.description,
    scales: [...scalesMap.values()],
    semantic: { ...(a.semantic ?? {}), ...(b.semantic ?? {}) },
    spacing: { ...(a.spacing ?? {}), ...(b.spacing ?? {}) },
    radius: { ...(a.radius ?? {}), ...(b.radius ?? {}) },
    shadow: { ...(a.shadow ?? {}), ...(b.shadow ?? {}) },
    typography: { ...(a.typography ?? {}), ...(b.typography ?? {}) },
    updatedAt: Date.now(),
  };
}
