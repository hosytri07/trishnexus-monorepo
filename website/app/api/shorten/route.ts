/**
 * POST /api/shorten — Phase 19.17.
 * Body: { url: string }
 * Sử dụng public service is.gd (free, no API key) — fallback tinyurl.
 */
import { NextResponse } from 'next/server';

interface Body { url?: string; }

export async function POST(req: Request): Promise<Response> {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Body JSON không hợp lệ' }, { status: 400 });
  }
  const url = (body.url ?? '').trim();
  if (!url) return NextResponse.json({ error: 'Thiếu URL' }, { status: 400 });
  // Validate
  try { new URL(url); } catch {
    return NextResponse.json({ error: 'URL không hợp lệ' }, { status: 400 });
  }

  // Try is.gd first
  try {
    const isgd = await fetch(
      `https://is.gd/create.php?format=json&url=${encodeURIComponent(url)}`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (isgd.ok) {
      const data = await isgd.json();
      if (data.shorturl) {
        return NextResponse.json({ short: data.shorturl, provider: 'is.gd' });
      }
    }
  } catch (err) {
    console.warn('[shorten] is.gd fail', err);
  }

  // Fallback tinyurl
  try {
    const tu = await fetch(
      `https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (tu.ok) {
      const text = await tu.text();
      if (text.startsWith('http')) {
        return NextResponse.json({ short: text.trim(), provider: 'tinyurl' });
      }
    }
  } catch (err) {
    console.warn('[shorten] tinyurl fail', err);
  }

  return NextResponse.json({ error: 'Cả 2 service đều fail' }, { status: 502 });
}
