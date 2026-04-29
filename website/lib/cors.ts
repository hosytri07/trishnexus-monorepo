/**
 * lib/cors.ts — Phase 19.24.
 *
 * CORS helpers cho /api/admin/* để TrishAdmin desktop (Tauri WebView) fetch được.
 * Tauri origin là `tauri://localhost` hoặc `https://tauri.localhost` — em dùng
 * wildcard `*` cho admin API vì đã verify Bearer ID token (security ở token, không CORS).
 */
import { NextResponse } from 'next/server';

export const ADMIN_CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

/** Wrap NextResponse.json() with CORS headers. */
export function corsJson(
  body: unknown,
  init?: { status?: number; headers?: Record<string, string> },
): NextResponse {
  const res = NextResponse.json(body, { status: init?.status ?? 200 });
  for (const [k, v] of Object.entries(ADMIN_CORS_HEADERS)) {
    res.headers.set(k, v);
  }
  for (const [k, v] of Object.entries(init?.headers ?? {})) {
    res.headers.set(k, v);
  }
  return res;
}

/** Pre-flight OPTIONS handler shared. */
export async function corsOptions(): Promise<Response> {
  return new Response(null, { status: 204, headers: ADMIN_CORS_HEADERS });
}
