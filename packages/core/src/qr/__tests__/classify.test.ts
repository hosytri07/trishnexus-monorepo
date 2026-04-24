import { describe, it, expect } from 'vitest';
import { classifyQr, validateQrText, suggestFilename } from '../index.js';

describe('classifyQr', () => {
  it('https URL', () => {
    expect(classifyQr('https://trishteam.io.vn')).toBe('url');
  });

  it('http URL', () => {
    expect(classifyQr('http://example.com')).toBe('url');
  });

  it('email mailto', () => {
    expect(classifyQr('mailto:a@b.com')).toBe('email');
  });

  it('email bare', () => {
    expect(classifyQr('hello@world.com')).toBe('email');
  });

  it('phone tel', () => {
    expect(classifyQr('tel:+84901234567')).toBe('phone');
  });

  it('phone bare +84', () => {
    expect(classifyQr('+84 901 234 567')).toBe('phone');
  });

  it('wifi payload', () => {
    expect(classifyQr('WIFI:T:WPA;S:MyNetwork;P:pass;;')).toBe('wifi');
  });

  it('vcard payload', () => {
    expect(classifyQr('BEGIN:VCARD\nVERSION:3.0\nEND:VCARD')).toBe('vcard');
  });

  it('plain text fallback', () => {
    expect(classifyQr('Just some text')).toBe('text');
  });
});

describe('validateQrText', () => {
  it('empty → error', () => {
    expect(validateQrText('')).toBe('Nội dung QR không được trống');
    expect(validateQrText('   ')).toBe('Nội dung QR không được trống');
  });

  it('normal → null', () => {
    expect(validateQrText('hello')).toBeNull();
  });

  it('quá dài → error', () => {
    expect(validateQrText('a'.repeat(3000))).toContain('vượt');
  });
});

describe('suggestFilename', () => {
  it('URL → trishqr-url-<slug>-<date>.png', () => {
    const name = suggestFilename('https://trishteam.io.vn');
    expect(name).toMatch(/^trishqr-url-https-trishteam-io-vn-\d{4}-\d{2}-\d{2}\.png$/);
  });

  it('email → trishqr-email-*', () => {
    const name = suggestFilename('hello@world.com');
    expect(name).toMatch(/^trishqr-email-/);
  });

  it('text tiếng Việt → fold diacritics', () => {
    const name = suggestFilename('Chào thế giới');
    expect(name).toMatch(/^trishqr-text-chao-the-gioi-/);
  });
});
