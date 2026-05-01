/**
 * TrishFinance — Phase 23.2.A state hook + helpers.
 *
 * useFinanceDb: persist toàn bộ FinanceDb vào localStorage `trishfinance_db`.
 * Migration auto: nếu db.dbVersion khác CURRENT_DB_VERSION → reset về EMPTY_DB.
 *
 * Helpers (shared) export ở đây để mọi module dùng chung: now, today, createId,
 * money, dateVN, daysUntil, escapeHtml, toCsv, downloadBlob, normalizeText,
 * monthLabel.
 */

import { useEffect, useState, useCallback } from 'react';
import { EMPTY_DB, type FinanceDb } from './types';

const DB_KEY = 'trishfinance_db';
const CURRENT_DB_VERSION = '23.9.1';

function loadDb(): FinanceDb {
  if (typeof window === 'undefined') return EMPTY_DB;
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) return { ...EMPTY_DB };
    const parsed = JSON.parse(raw) as FinanceDb;
    if (parsed.dbVersion !== CURRENT_DB_VERSION) {
      console.log('[trishfinance] DB version mismatch → reset', parsed.dbVersion, '→', CURRENT_DB_VERSION);
      return { ...EMPTY_DB };
    }
    // Defensive merge với EMPTY_DB để có tất cả keys mới (nếu update type)
    return { ...EMPTY_DB, ...parsed };
  } catch (e) {
    console.warn('[trishfinance] loadDb failed:', e);
    return { ...EMPTY_DB };
  }
}

function saveDb(db: FinanceDb): void {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  } catch (e) {
    console.warn('[trishfinance] saveDb failed:', e);
  }
}

/**
 * Hook chính: lấy db + setter giúp update + auto-persist.
 *
 * Usage:
 *   const { db, setDb, update } = useFinanceDb();
 *   update(d => { d.phongs.push(newPhong); });   // mutate-style
 *   setDb({ ...db, phongs: [...db.phongs, newPhong] });   // replace-style
 */
export function useFinanceDb(): {
  db: FinanceDb;
  setDb: (next: FinanceDb) => void;
  update: (mutator: (draft: FinanceDb) => void) => void;
  resetDb: () => void;
} {
  const [db, setDbState] = useState<FinanceDb>(loadDb);

  useEffect(() => {
    saveDb(db);
  }, [db]);

  const setDb = useCallback((next: FinanceDb) => {
    setDbState(next);
  }, []);

  const update = useCallback((mutator: (draft: FinanceDb) => void) => {
    setDbState(prev => {
      // Shallow clone toàn bộ collection để React detect change
      const next: FinanceDb = {
        ...prev,
        accounts: [...prev.accounts],
        properties: [...prev.properties],
        phongs: [...prev.phongs],
        khachs: [...prev.khachs],
        hopDongs: [...prev.hopDongs],
        dienNuoc: [...prev.dienNuoc],
        hoaDons: [...prev.hoaDons],
        thanhToans: [...prev.thanhToans],
        suCos: [...prev.suCos],
        chiPhis: [...prev.chiPhis],
        ledger: [...prev.ledger],
        budgets: [...prev.budgets],
        recurrings: [...prev.recurrings],
        shops: [...prev.shops],
        products: [...prev.products],
        orders: [...prev.orders],
        customers: [...prev.customers],
        stations: [...prev.stations],
        stationSessions: [...prev.stationSessions],
        cafeTables: [...prev.cafeTables],
        logs: [...prev.logs],
      };
      mutator(next);
      return next;
    });
  }, []);

  const resetDb = useCallback(() => {
    setDbState({ ...EMPTY_DB });
  }, []);

  return { db, setDb, update, resetDb };
}

// ==========================================================
// Shared helpers
// ==========================================================
export function now(): string { return new Date().toISOString(); }

export function today(): string { return new Date().toISOString().slice(0, 10); }

export function thisMonth(): { thang: number; nam: number } {
  const d = new Date();
  return { thang: d.getMonth() + 1, nam: d.getFullYear() };
}

export function createId(prefix = 'id'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function money(n: number | undefined | null): string {
  if (!n && n !== 0) return '0đ';
  return new Intl.NumberFormat('vi-VN').format(Math.round(n)) + 'đ';
}

export function moneyShort(n: number | undefined | null): string {
  if (!n && n !== 0) return '0';
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + 'tỷ';
  if (abs >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'tr';
  if (abs >= 1_000) return (n / 1_000).toFixed(0) + 'k';
  return String(n);
}

export function dateVN(value: string | undefined | null): string {
  if (!value) return '-';
  const d = new Date(value.length === 10 ? value + 'T00:00:00' : value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat('vi-VN').format(d);
}

export function daysUntil(value: string): number {
  if (!value) return 99999;
  const d = new Date(value + 'T00:00:00');
  const t = new Date(today() + 'T00:00:00');
  return Math.ceil((d.getTime() - t.getTime()) / 86400000);
}

export function monthLabel(thang: number, nam: number): string {
  return `${String(thang).padStart(2, '0')}/${nam}`;
}

export function normalizeText(value: any): string {
  return String(value ?? '').trim().toLowerCase().normalize('NFD')
    .replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

export function escapeHtml(value: any): string {
  return String(value ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch] || ch));
}

export function toCsv(rows: any[][]): string {
  return '﻿' + rows.map(r => r.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ==========================================================
// Audit log helper
// ==========================================================
export function appendLog(db: FinanceDb, action: string, module?: 'nhatro' | 'taichinh' | 'banhang' | 'system'): void {
  db.logs = [
    { id: createId('log'), time: now(), action, module },
    ...db.logs,
  ].slice(0, 200);
}

// ==========================================================
// VietQR URL builder
// (Dùng API miễn phí của vietqr.io — encode chuyển khoản tự động)
// ==========================================================
export function vietQrUrl(input: {
  bankCode: string;     // VD "ICB", "VCB", "BIDV"...
  accountNumber: string;
  accountName: string;
  amount?: number;
  message?: string;
}): string {
  const { bankCode, accountNumber, accountName, amount, message } = input;
  if (!bankCode || !accountNumber) return '';
  const params = new URLSearchParams();
  if (amount && amount > 0) params.set('amount', String(Math.round(amount)));
  if (message) params.set('addInfo', message);
  if (accountName) params.set('accountName', accountName);
  // Format: https://img.vietqr.io/image/{BANK}-{ACCOUNT}-compact2.png?...
  const base = `https://img.vietqr.io/image/${encodeURIComponent(bankCode)}-${encodeURIComponent(accountNumber)}-compact2.png`;
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}
