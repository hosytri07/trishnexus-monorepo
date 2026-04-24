/**
 * POST /api/embed — Phase 12.3 (semantic search stub).
 *
 * Mục tiêu: tạo endpoint chuẩn hoá để sinh vector embedding cho 1 đoạn
 * văn bản tiếng Việt (hoặc đa ngôn ngữ) — phục vụ universal search
 * Phase 12.x. Endpoint được thiết kế để swap provider dễ dàng:
 *
 *   - Priority 1 (prod): Google Gemini `text-embedding-004` (768-dim,
 *     hỗ trợ VN tốt). Yêu cầu env `GOOGLE_AI_API_KEY`.
 *   - Priority 2 (dev/offline fallback): hash-bucket pseudo-embedding
 *     deterministic (256-dim) — KHÔNG chất lượng semantic thật, nhưng
 *     cho phép client chạy pipeline mà không cần API key.
 *
 * Request body:
 *   { "texts": string[]  }  (max 32 item, max 4k char mỗi item)
 *
 * Response:
 *   {
 *     "provider": "gemini" | "local-hash",
 *     "dim": 768 | 256,
 *     "vectors": number[][]
 *   }
 *
 * Note về client usage:
 *   - Gọi khi user gõ truy vấn ổn định (debounce 500ms) hoặc khi admin
 *     index announcement/note mới.
 *   - Client lưu vectors vào Firestore `/semantic/{collection}/{id}` —
 *     schema draft ở Phase 12.3 chưa wire, sẽ làm ở Phase 12.4.
 *   - Cosine similarity = dot(a,b) / (|a|*|b|). Với Gemini 004 normalize
 *     sẵn nên dot product = cosine.
 *
 * Roadmap:
 *   - 12.3 (here): endpoint + fallback local + tests manual.
 *   - 12.4: Firestore schema `/semantic/{kind}/{id}` với field `vec`,
 *     `model`, `updatedAt`. Client reranker sau Fuse top-K.
 *   - 12.5: Admin UI "Reindex all" + Cloud Function re-embed khi
 *     doc thay đổi.
 */
import { NextResponse, type NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body {
  texts?: unknown;
}

const MAX_ITEMS = 32;
const MAX_CHARS = 4000;

/** Deterministic hash-bucket pseudo-embedding (256-dim) cho dev fallback. */
function localHashEmbedding(text: string, dim = 256): number[] {
  const out = new Array<number>(dim).fill(0);
  const lower = text.toLowerCase().normalize('NFC');
  // Token theo whitespace + punctuation.
  const tokens = lower.split(/[\s,.!?;:"'()[\]{}\-/\\]+/).filter(Boolean);
  for (const tok of tokens) {
    let h = 2166136261; // FNV-1a offset
    for (let i = 0; i < tok.length; i++) {
      h ^= tok.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    const idx = Math.abs(h) % dim;
    out[idx] += 1;
  }
  // L2 normalize.
  let norm = 0;
  for (const v of out) norm += v * v;
  norm = Math.sqrt(norm) || 1;
  return out.map((v) => v / norm);
}

async function geminiEmbed(text: string, apiKey: string): Promise<number[]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${encodeURIComponent(
    apiKey,
  )}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      content: { parts: [{ text }] },
      taskType: 'RETRIEVAL_DOCUMENT',
    }),
  });
  if (!resp.ok) {
    throw new Error(`gemini_embed_${resp.status}`);
  }
  const json = (await resp.json()) as {
    embedding?: { values?: number[] };
  };
  const values = json.embedding?.values;
  if (!Array.isArray(values)) {
    throw new Error('gemini_embed_no_values');
  }
  return values;
}

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  if (!Array.isArray(body.texts)) {
    return NextResponse.json(
      { error: 'texts_must_be_array' },
      { status: 400 },
    );
  }
  if (body.texts.length === 0) {
    return NextResponse.json({ error: 'texts_empty' }, { status: 400 });
  }
  if (body.texts.length > MAX_ITEMS) {
    return NextResponse.json(
      { error: `max_${MAX_ITEMS}_items` },
      { status: 413 },
    );
  }
  const texts: string[] = [];
  for (const t of body.texts) {
    if (typeof t !== 'string') {
      return NextResponse.json(
        { error: 'texts_must_be_strings' },
        { status: 400 },
      );
    }
    texts.push(t.slice(0, MAX_CHARS));
  }

  const apiKey = process.env.GOOGLE_AI_API_KEY;

  // Provider selection.
  if (apiKey) {
    try {
      const vectors: number[][] = [];
      for (const t of texts) {
        // Gemini embedContent = 1 text/request. Batch = sequential (OK cho MVP).
        const v = await geminiEmbed(t, apiKey);
        vectors.push(v);
      }
      return NextResponse.json({
        provider: 'gemini',
        model: 'text-embedding-004',
        dim: vectors[0]?.length ?? 768,
        vectors,
      });
    } catch (e) {
      // Fall through to local fallback — đừng fail hard khi Gemini ngừng hoạt động.
      console.warn('[embed] gemini fail, fallback local:', e);
    }
  }

  const vectors = texts.map((t) => localHashEmbedding(t, 256));
  return NextResponse.json({
    provider: 'local-hash',
    model: 'fnv1a-bucket-256',
    dim: 256,
    vectors,
    note: apiKey
      ? 'Gemini API failed — fallback local. Check GOOGLE_AI_API_KEY quota.'
      : 'GOOGLE_AI_API_KEY chưa set. Đang dùng hash fallback (không có semantic).',
  });
}

export function GET() {
  return NextResponse.json({
    status: 'ok',
    usage: 'POST { texts: string[] } → { vectors: number[][] }',
    providers: {
      primary: 'gemini text-embedding-004 (768-dim, cần GOOGLE_AI_API_KEY)',
      fallback: 'local hash-bucket FNV-1a (256-dim, dev only)',
    },
  });
}
