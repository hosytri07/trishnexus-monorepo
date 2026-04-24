import { describe, it, expect } from 'vitest';
import { foldVietnamese, tokenize } from '../fold.js';

describe('foldVietnamese', () => {
  it('bỏ dấu tiếng Việt cơ bản', () => {
    expect(foldVietnamese('Số phận')).toBe('so phan');
    expect(foldVietnamese('TrishTEAM — Ứng dụng')).toBe('trishteam — ung dung');
  });

  it('chuyển đ/Đ thành d/D rồi lowercase', () => {
    expect(foldVietnamese('Đà Nẵng')).toBe('da nang');
    expect(foldVietnamese('Đi đâu')).toBe('di dau');
  });

  it('giữ nguyên ký tự ASCII đã lowercase', () => {
    expect(foldVietnamese('hello world')).toBe('hello world');
  });

  it('empty string không throw', () => {
    expect(foldVietnamese('')).toBe('');
  });
});

describe('tokenize', () => {
  it('tách từ + fold dấu', () => {
    expect(tokenize('Số phận của anh')).toEqual(['so', 'phan', 'cua', 'anh']);
  });

  it('loại bỏ token ngắn hơn 2 ký tự', () => {
    expect(tokenize('a bc def g')).toEqual(['bc', 'def']);
  });

  it('strip ký tự đặc biệt', () => {
    expect(tokenize('email: hello@world.com')).toEqual([
      'email',
      'hello',
      'world',
      'com',
    ]);
  });
});
