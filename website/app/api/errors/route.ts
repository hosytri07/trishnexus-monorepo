/**
 * POST /api/errors — Phase 16.5.
 *
 * Ingest error event từ client (`lib/error-report.ts`). Sanitize strict
 * rồi ghi vào Firestore `/errors/{env}/samples/{auto-id}` qua Admin SDK.
 *
 * Schema sample:
 *   {
 *     kind: 'error'|'unhandledrejection'|'react',
 *     message, stack?, source?, line?, column?, componentStack?,
 *     path, ua, ts (server stamp), release?, fingerprint, clientTs
 *   }
 *
 * Security:
 *   - Public endpoint (client chưa login vẫn cần báo cáo được crash).
 *   - KHÔNG log user id hay cookie — chỉ UA + pathname.
 *   - Rate-limit soft: từ chối payload > 16KB.
 *   - Validate shape: kind hợp lệ, message phải string non-empty.
 *
 * Nếu Admin SDK chưa config → 204 no-op (client không retry).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb, adminReady } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BODY = 16 * 1024;
const VALID_KINDS = new Set(['error', 'unhandledrejection', 'react']);

interface RawBody {
  kind?: unknown;
  message?: unknown;
  stack?: unknown;
  source?: unknown;
  line?: unknown;
  column?: unknown;
  componentStack?: unknown;
  path?: unknown;
  ua?: unknown;
  ts?: unknown;
  release?: unknown;
  fingerprint?: unknown;
}

function asStr(v: unknown, max: number): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  if (!t) return undefined;
  return t.length > max ? t.slice(0, max) : t;
}

function asNum(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

function sanitize(raw: RawBody): null | {
  kind: string;
  message: string;
  stack?: string;
  source?: string;
  line?: number;
  column?: number;
  componentStack?: string;
  path: string;
  ua: string;
  release?: string;
  fingerprint?: string;
  clientTs?: number;
} {
  if (typeof raw !== 'object' || raw === null) return null;
  const kind = typeof raw.kind === 'string' ? raw.kind : '';
  if (!VALID_KINDS.has(kind)) return null;
  const message = asStr(raw.message, 500);
  if (!message) return null;

  return {
    kind,
    message,
    stack: asStr(raw.stack, 4000),
    source: asStr(raw.source, 300),
    line: asNum(raw.line),
    column: asNum(raw.column),
    componentStack: asStr(raw.componentStack, 2000),
    path: asStr(raw.path, 200) ?? '/',
    ua: asStr(raw.ua, 120) ?? '',
    release: asStr(raw.release, 60),
    fingerprint: asStr(raw.fingerprint, 32),
    clientTs: asNum(raw.ts),
  };
}

export async function POST(req: NextRequest) {
  if (!adminReady()) {
    return new NextResponse(null, { status: 204 });
  }

  const len = Number(req.headers.get('content-length') ?? '0');
  if (len > MAX_BODY) {
    return NextResponse.json({ error: 'payload_too_large' }, { status: 413 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const cleaned = sanitize(raw as RawBody);
  if (!cleaned) {
    return NextResponse.json({ error: 'invalid_shape' }, { status: 400 });
  }

  try {
    const env = process.env.NODE_ENV === 'production' ? 'prod' : 'dev';
    await adminDb()
      .collection('errors')
      .doc(env)
      .collection('samples')
      .add({
        ...cleaned,
        ts: FieldValue.serverTimestamp(),
      });
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    console.warn('[api/errors] write fail', e);
    return NextResponse.json({ error: 'write_fail' }, { status: 500 });
  }
}

export function GET() {
  return NextResponse.json({
    endpoint: '/api/errors',
    method: 'POST',
    body: 'ReportInput — xem lib/error-report.ts',
    note: 'Phase 16.5 — ghi vào /errors/{env}/samples/{auto-id}',
  });
}
