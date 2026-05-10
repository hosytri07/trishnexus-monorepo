/**
 * Content loader cho 2 panel read-only:
 *   - Tools (tips/tricks fix Windows + phần mềm)
 *   - Software collection (tổng hợp link tải)
 *
 * Pattern giống specs-loader: fetch remote JSON từ trishteam.io.vn,
 * fallback bundled khi offline / fail. Admin curate qua TrishAdmin
 * sẽ publish file vào /public/check/{tips,software}.json.
 */

import { fetchText } from '../tauri-bridge.js';
import bundledTips from '../data/tips.json';
import bundledSoftware from '../data/software-collection.json';

export interface TipLink {
  label: string;
  url: string;
}

export interface TipItem {
  id: string;
  title: string;
  category: string;
  tags: string[];
  summary: string;
  body: string;
  links: TipLink[];
}

export interface TipsFile {
  updated_at: string;
  note?: string;
  items: TipItem[];
}

export interface SoftwareLink {
  label: string;
  url: string;
}

export interface SoftwareItem {
  id: string;
  name: string;
  category: string;
  type: 'free' | 'paid' | 'freemium' | 'trial';
  vendor: string;
  description: string;
  links: SoftwareLink[];
  alternatives?: string[];
}

export interface SoftwareFile {
  updated_at: string;
  note?: string;
  items: SoftwareItem[];
}

export interface ContentLoadResult<T> {
  data: T;
  source: 'remote' | 'bundled';
  fetchedAt: number | null;
  error: string | null;
}

export const TIPS_URL = 'https://www.trishteam.io.vn/check/tips.json';
export const SOFTWARE_URL = 'https://www.trishteam.io.vn/check/software.json';

function isValidTipsFile(data: unknown): data is TipsFile {
  if (!data || typeof data !== 'object') return false;
  const r = data as Record<string, unknown>;
  return Array.isArray(r.items);
}

function isValidSoftwareFile(data: unknown): data is SoftwareFile {
  if (!data || typeof data !== 'object') return false;
  const r = data as Record<string, unknown>;
  return Array.isArray(r.items);
}

export async function loadTips(
  url: string = TIPS_URL,
): Promise<ContentLoadResult<TipsFile>> {
  try {
    const text = await fetchText(url);
    const json = JSON.parse(text) as unknown;
    if (!isValidTipsFile(json)) throw new Error('tips schema mismatch');
    return { data: json, source: 'remote', fetchedAt: Date.now(), error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[trishcheck] tips fetch fail, using bundled:', msg);
    return {
      data: bundledTips as TipsFile,
      source: 'bundled',
      fetchedAt: null,
      error: msg,
    };
  }
}

export async function loadSoftwareCollection(
  url: string = SOFTWARE_URL,
): Promise<ContentLoadResult<SoftwareFile>> {
  try {
    const text = await fetchText(url);
    const json = JSON.parse(text) as unknown;
    if (!isValidSoftwareFile(json)) throw new Error('software schema mismatch');
    return { data: json, source: 'remote', fetchedAt: Date.now(), error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[trishcheck] software fetch fail, using bundled:', msg);
    return {
      data: bundledSoftware as SoftwareFile,
      source: 'bundled',
      fetchedAt: null,
      error: msg,
    };
  }
}
