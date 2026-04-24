/**
 * Export DesignTokenSet → nhiều format kỹ thuật:
 *   - CSS custom properties (`:root { --color-primary-500: #…; }`)
 *   - Tailwind config JS snippet (`theme.extend.colors = {...}`)
 *   - Figma Tokens JSON (studio plugin format)
 *   - SCSS map
 */

import type { ColorScale, DesignTokenSet } from './types.js';
import { resolveSemantic } from './tokens.js';

/** Build CSS custom properties block — return full text có `:root { … }`. */
export function toCssVars(set: DesignTokenSet): string {
  const lines: string[] = [':root {'];
  for (const scale of set.scales) {
    for (const sw of scale.swatches) {
      lines.push(`  --color-${kebab(scale.name)}-${sw.key}: ${sw.hex};`);
    }
  }
  if (set.semantic) {
    for (const [alias, _v] of Object.entries(set.semantic)) {
      const hex = resolveSemantic(set, alias);
      if (hex) lines.push(`  --color-${kebab(alias)}: ${hex};`);
    }
  }
  if (set.spacing) {
    for (const [k, v] of Object.entries(set.spacing)) {
      lines.push(`  --spacing-${kebab(k)}: ${v};`);
    }
  }
  if (set.radius) {
    for (const [k, v] of Object.entries(set.radius)) {
      lines.push(`  --radius-${kebab(k)}: ${v};`);
    }
  }
  if (set.shadow) {
    for (const [k, v] of Object.entries(set.shadow)) {
      lines.push(`  --shadow-${kebab(k)}: ${v};`);
    }
  }
  lines.push('}');
  return lines.join('\n');
}

/** Build Tailwind config snippet — chỉ phần `theme.extend.colors`. */
export function toTailwindConfigJs(set: DesignTokenSet): string {
  const colors: Record<string, Record<string, string> | string> = {};
  for (const scale of set.scales) {
    const entry: Record<string, string> = {};
    for (const sw of scale.swatches) entry[sw.key] = sw.hex;
    colors[scale.name] = entry;
  }
  if (set.semantic) {
    for (const alias of Object.keys(set.semantic)) {
      const hex = resolveSemantic(set, alias);
      if (hex) colors[alias] = hex;
    }
  }
  const body = JSON.stringify(colors, null, 2);
  return [
    '/** @type {import("tailwindcss").Config} */',
    'module.exports = {',
    '  theme: {',
    '    extend: {',
    `      colors: ${body.split('\n').join('\n      ')},`,
    '    },',
    '  },',
    '};',
  ].join('\n');
}

/**
 * Figma Tokens JSON — format w3c style tokens (value + type).
 * Plugin "Tokens Studio" đọc được.
 */
export function toFigmaTokensJson(set: DesignTokenSet): string {
  const root: Record<string, unknown> = {};
  for (const scale of set.scales) {
    const obj: Record<string, { value: string; type: 'color' }> = {};
    for (const sw of scale.swatches) {
      obj[sw.key] = { value: sw.hex, type: 'color' };
    }
    root[scale.name] = obj;
  }
  if (set.semantic) {
    const sem: Record<string, { value: string; type: 'color' }> = {};
    for (const alias of Object.keys(set.semantic)) {
      const hex = resolveSemantic(set, alias);
      if (hex) sem[alias] = { value: hex, type: 'color' };
    }
    root.semantic = sem;
  }
  if (set.spacing) {
    const sp: Record<string, { value: string; type: 'spacing' }> = {};
    for (const [k, v] of Object.entries(set.spacing)) {
      sp[k] = { value: v, type: 'spacing' };
    }
    root.spacing = sp;
  }
  if (set.radius) {
    const r: Record<string, { value: string; type: 'borderRadius' }> = {};
    for (const [k, v] of Object.entries(set.radius)) {
      r[k] = { value: v, type: 'borderRadius' };
    }
    root.radius = r;
  }
  if (set.shadow) {
    const sh: Record<string, { value: string; type: 'boxShadow' }> = {};
    for (const [k, v] of Object.entries(set.shadow)) {
      sh[k] = { value: v, type: 'boxShadow' };
    }
    root.shadow = sh;
  }
  return JSON.stringify(root, null, 2);
}

/** SCSS map — `$primary: (50: …, 100: …);`. */
export function toScssMap(set: DesignTokenSet): string {
  const lines: string[] = [];
  for (const scale of set.scales) {
    lines.push(`$${kebab(scale.name)}: (`);
    for (const sw of scale.swatches) {
      lines.push(`  "${sw.key}": ${sw.hex},`);
    }
    lines.push(');');
    lines.push('');
  }
  if (set.semantic) {
    const semLines: string[] = ['$semantic: ('];
    for (const alias of Object.keys(set.semantic)) {
      const hex = resolveSemantic(set, alias);
      if (hex) semLines.push(`  "${kebab(alias)}": ${hex},`);
    }
    semLines.push(');');
    lines.push(...semLines);
  }
  return lines.join('\n').trimEnd();
}

/** Export 1 scale gọn thành JSON object (ko kèm tokenSet wrap). */
export function scaleToPlainJson(scale: ColorScale): string {
  const obj: Record<string, string> = {};
  for (const sw of scale.swatches) obj[sw.key] = sw.hex;
  return JSON.stringify(obj, null, 2);
}

function kebab(input: string): string {
  return input
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}
