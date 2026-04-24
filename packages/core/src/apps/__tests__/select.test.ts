import { describe, it, expect } from 'vitest';
import {
  mergeApp,
  mergeRegistry,
  findAppById,
  filterByStatus,
  filterByPlatform,
  filterPublic,
  statusLabel,
  loginRequiredLabel,
  formatSize,
  pickDownload,
} from '../select.js';
import type {
  AppMeta,
  AppRegistry,
  AppRegistryEntry,
} from '../types.js';

const sampleEntry: AppRegistryEntry = {
  id: 'trishfont',
  name: 'TrishFont',
  tagline: 'Font manager',
  logo_url: 'https://example.com/logo.png',
  version: '1.0.0',
  size_bytes: 25_000_000,
  status: 'released',
  login_required: 'none',
  platforms: ['windows_x64', 'macos_arm64'],
  screenshots: [],
  changelog_url: '',
  download: {
    windows_x64: {
      url: 'https://example.com/win.exe',
      sha256: 'abc',
      installer_args: ['/S'],
    },
    macos_arm64: {
      url: 'https://example.com/mac.dmg',
      sha256: 'def',
      installer_args: [],
    },
  },
};

const sampleMeta: AppMeta = {
  release_date: '2026-01-15',
  features: ['Feature 1', 'Feature 2'],
  accent: '#F59E0B',
  icon_fallback: 'Type',
  logo_path: '/logos/TrishFont/icon-256.png',
};

describe('mergeApp', () => {
  it('merge entry + meta', () => {
    const merged = mergeApp(sampleEntry, sampleMeta);
    expect(merged.id).toBe('trishfont');
    expect(merged.features).toEqual(['Feature 1', 'Feature 2']);
    expect(merged.accent).toBe('#F59E0B');
  });

  it('meta undefined → fallback', () => {
    const merged = mergeApp(sampleEntry, undefined);
    expect(merged.features).toEqual([]);
    expect(merged.accent).toBe('#667EEA');
    expect(merged.icon_fallback).toBe('Box');
  });
});

describe('mergeRegistry + findAppById', () => {
  const registry: AppRegistry = {
    schema_version: 2,
    updated_at: '2026-04-23',
    ecosystem: {
      name: 'TrishTEAM',
      tagline: 't',
      logo_url: '',
      website: '',
    },
    apps: [sampleEntry],
  };

  it('merge full registry', () => {
    const apps = mergeRegistry(registry, { trishfont: sampleMeta });
    expect(apps).toHaveLength(1);
    expect(apps[0]?.release_date).toBe('2026-01-15');
  });

  it('findAppById hit', () => {
    const apps = mergeRegistry(registry, {});
    expect(findAppById(apps, 'trishfont')?.name).toBe('TrishFont');
  });

  it('findAppById miss → null', () => {
    const apps = mergeRegistry(registry, {});
    expect(findAppById(apps, 'nope')).toBeNull();
  });
});

describe('filterByStatus/Platform/Public', () => {
  const beta = { ...sampleEntry, id: 'b', status: 'beta' as const };
  const coming = { ...sampleEntry, id: 'c', status: 'coming_soon' as const };
  const apps = [
    mergeApp(sampleEntry, sampleMeta), // released, public, windows+mac
    mergeApp(beta, sampleMeta),
    mergeApp(coming, sampleMeta),
  ];

  it('filterByStatus default giữ tất cả', () => {
    expect(filterByStatus(apps)).toHaveLength(3);
  });

  it('filterByStatus chỉ released', () => {
    expect(filterByStatus(apps, ['released'])).toHaveLength(1);
  });

  it('filterByPlatform windows_x64', () => {
    expect(filterByPlatform(apps, 'windows_x64')).toHaveLength(3);
  });

  it('filterByPlatform linux_x64 (không có app nào support)', () => {
    expect(filterByPlatform(apps, 'linux_x64')).toHaveLength(0);
  });

  it('filterPublic chỉ login_required=none', () => {
    const privateApp = mergeApp(
      { ...sampleEntry, id: 'p', login_required: 'user' },
      sampleMeta,
    );
    expect(filterPublic([privateApp, ...apps])).toHaveLength(3);
  });
});

describe('label + format helpers', () => {
  it('statusLabel', () => {
    expect(statusLabel('released')).toBe('Đã phát hành');
    expect(statusLabel('beta')).toBe('Beta');
    expect(statusLabel('coming_soon')).toBe('Sắp ra mắt');
  });

  it('loginRequiredLabel', () => {
    expect(loginRequiredLabel('none')).toContain('Miễn phí');
    expect(loginRequiredLabel('admin')).toContain('admin');
  });

  it('formatSize', () => {
    expect(formatSize(0)).toBe('—');
    expect(formatSize(500 * 1024)).toBe('500 KB');
    expect(formatSize(25_000_000)).toBe('23.8 MB');
    expect(formatSize(2_000_000_000)).toBe('1.86 GB');
  });
});

describe('pickDownload', () => {
  it('preference order hit', () => {
    const picked = pickDownload(sampleEntry, ['macos_arm64', 'windows_x64']);
    expect(picked?.platform).toBe('macos_arm64');
  });

  it('skip miss → next', () => {
    const picked = pickDownload(sampleEntry, ['linux_x64', 'windows_x64']);
    expect(picked?.platform).toBe('windows_x64');
  });

  it('tất cả miss → null', () => {
    const picked = pickDownload(sampleEntry, ['linux_x64']);
    expect(picked).toBeNull();
  });
});
