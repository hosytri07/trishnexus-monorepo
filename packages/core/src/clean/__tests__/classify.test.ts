import { describe, it, expect } from 'vitest';
import { classifyPath } from '../classify.js';

const NOW = 1_745_480_000_000;
const DAY = 86_400_000;

function input(over: Partial<Parameters<typeof classifyPath>[0]> & { path: string }) {
  return {
    size_bytes: 1024,
    accessed_at_ms: NOW,
    is_dir: false,
    nowMs: NOW,
    ...over,
  };
}

describe('classifyPath', () => {
  it('folder rỗng → empty_dir', () => {
    expect(
      classifyPath(input({ path: '/tmp/x', is_dir: true, size_bytes: 0 })),
    ).toBe('empty_dir');
  });

  it('path chứa /cache/ → cache', () => {
    expect(classifyPath(input({ path: '/home/user/.cache/foo' }))).toBe('cache');
  });

  it('Windows AppData Local Temp → temp', () => {
    expect(
      classifyPath(input({
        path: 'C:\\Users\\Trí\\AppData\\Local\\Temp\\huge.bin',
      })),
    ).toBe('temp');
  });

  it('Downloads folder → download', () => {
    expect(
      classifyPath(input({ path: '/Users/tri/Downloads/file.zip' })),
    ).toBe('download');
  });

  it('Windows $Recycle.Bin → recycle', () => {
    expect(
      classifyPath(input({ path: 'C:\\$Recycle.Bin\\file' })),
    ).toBe('recycle');
  });

  it('macOS .Trash → recycle', () => {
    expect(
      classifyPath(input({ path: '/Users/tri/.Trash/old' })),
    ).toBe('recycle');
  });

  it('file > 100MB → large', () => {
    expect(
      classifyPath(input({
        path: '/home/user/movie.mp4',
        size_bytes: 200 * 1024 * 1024,
      })),
    ).toBe('large');
  });

  it('chưa access > 180 ngày → old', () => {
    expect(
      classifyPath(input({
        path: '/home/user/ancient.txt',
        accessed_at_ms: NOW - 200 * DAY,
      })),
    ).toBe('old');
  });

  it('cache thắng large (cache match trước)', () => {
    expect(
      classifyPath(input({
        path: '/cache/huge-cache.bin',
        size_bytes: 500 * 1024 * 1024,
      })),
    ).toBe('cache');
  });

  it('file thường → other', () => {
    expect(
      classifyPath(input({ path: '/home/user/notes.md' })),
    ).toBe('other');
  });

  it('case-insensitive match', () => {
    expect(
      classifyPath(input({ path: '/Users/TRI/DOWNLOADS/bar' })),
    ).toBe('download');
  });
});
