/**
 * Phase 78.13 — Device ID + hostname.
 *
 * Mỗi máy có 1 deviceId random lưu localStorage để phân biệt với máy khác
 * của cùng user (TrishTEAM ecosystem cho dùng nhiều máy).
 */
const DEVICE_KEY = 'trishutilities.device_id';
const DEVICE_NAME_KEY = 'trishutilities.device_name';

export function getDeviceId(): string {
  try {
    const existing = window.localStorage.getItem(DEVICE_KEY);
    if (existing) return existing;
    const id = `dev_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
    window.localStorage.setItem(DEVICE_KEY, id);
    return id;
  } catch {
    return 'dev_unknown';
  }
}

export function getDeviceName(): string {
  try {
    const saved = window.localStorage.getItem(DEVICE_NAME_KEY);
    if (saved) return saved;
  } catch {
    /* ignore */
  }
  // Fallback: lấy navigator.platform + một phần userAgent.
  if (typeof navigator !== 'undefined') {
    const platform = navigator.platform || 'Unknown';
    const ua = (navigator.userAgent || '').slice(0, 40);
    return `${platform} · ${ua}`;
  }
  return 'Unknown device';
}

export function setDeviceName(name: string): void {
  try {
    window.localStorage.setItem(DEVICE_NAME_KEY, name);
  } catch {
    /* ignore */
  }
}
