/**
 * POST /api/cloudinary/sign — Phase 19.12.
 *
 * Ký params upload với CLOUDINARY_API_SECRET (server-only).
 * Trả về signature để client POST trực tiếp lên Cloudinary.
 *
 * Body JSON: { folder, public_id?, tags? }
 *   - folder: 1 trong 5 preset trong CLOUDINARY_FOLDERS
 *   - public_id: optional (nếu muốn cố định ID, vd avatar uid)
 *   - tags: optional CSV
 *
 * Response: { signature, timestamp, apiKey, cloudName, params }
 *
 * Auth: Yêu cầu Firebase ID token (admin hoặc owner — kiểm tra theo folder).
 * MVP: cho mọi user signed-in upload vào avatar/temp; admin only cho sign/bridge/post.
 */
import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { adminAuth, adminReady } from '@/lib/firebase-admin';
import { CLOUDINARY_FOLDERS, type CloudinaryFolder } from '@/lib/cloudinary';

// Next.js 14: route đọc Authorization header → buộc dynamic, không static-render
export const dynamic = 'force-dynamic';

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const API_KEY = process.env.CLOUDINARY_API_KEY;
const API_SECRET = process.env.CLOUDINARY_API_SECRET;

// Folder nào cần admin? — admin-only
const ADMIN_ONLY_FOLDERS: CloudinaryFolder[] = ['sign', 'bridge', 'post'];

interface SignRequestBody {
  folder: CloudinaryFolder;
  publicId?: string;
  tags?: string;
}

export async function POST(req: Request): Promise<Response> {
  if (!CLOUD_NAME || !API_KEY || !API_SECRET) {
    return NextResponse.json(
      { error: 'Cloudinary chưa cấu hình env vars' },
      { status: 501 },
    );
  }

  // Verify Firebase ID token
  if (!adminReady()) {
    return NextResponse.json({ error: 'Firebase Admin SDK chưa cấu hình' }, { status: 501 });
  }
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Thiếu Bearer token' }, { status: 401 });
  }
  const idToken = authHeader.slice(7);
  let decodedToken;
  try {
    decodedToken = await adminAuth().verifyIdToken(idToken);
  } catch {
    return NextResponse.json({ error: 'Token không hợp lệ' }, { status: 401 });
  }

  let body: SignRequestBody;
  try {
    body = (await req.json()) as SignRequestBody;
  } catch {
    return NextResponse.json({ error: 'Body JSON không hợp lệ' }, { status: 400 });
  }

  if (!body.folder || !(body.folder in CLOUDINARY_FOLDERS)) {
    return NextResponse.json({ error: 'folder không hợp lệ' }, { status: 400 });
  }

  // Check admin-only folders
  if (ADMIN_ONLY_FOLDERS.includes(body.folder)) {
    // Lookup user role từ Firestore
    try {
      const { adminDb } = await import('@/lib/firebase-admin');
      const userDoc = await adminDb().collection('users').doc(decodedToken.uid).get();
      const role = userDoc.data()?.role;
      if (role !== 'admin') {
        return NextResponse.json(
          { error: `Folder "${body.folder}" chỉ admin được upload` },
          { status: 403 },
        );
      }
    } catch (err) {
      return NextResponse.json(
        { error: 'Không xác định được role: ' + String(err) },
        { status: 500 },
      );
    }
  }

  // Build sign params
  const timestamp = Math.floor(Date.now() / 1000);
  const cloudFolder = CLOUDINARY_FOLDERS[body.folder];

  // public_id: ép cho avatar = uid để overwrite; ngược lại auto generate
  let publicId = body.publicId;
  if (body.folder === 'avatar') {
    publicId = `${cloudFolder}/${decodedToken.uid}`;
  } else if (publicId) {
    publicId = `${cloudFolder}/${publicId}`;
  }

  const paramsToSign: Record<string, string | number> = {
    timestamp,
    folder: cloudFolder,
  };
  if (publicId) paramsToSign.public_id = publicId;
  if (body.tags) paramsToSign.tags = body.tags;

  // Build sortable signature string
  const sortedKeys = Object.keys(paramsToSign).sort();
  const signString = sortedKeys
    .map((k) => `${k}=${paramsToSign[k]}`)
    .join('&');
  const signature = crypto
    .createHash('sha1')
    .update(signString + API_SECRET)
    .digest('hex');

  return NextResponse.json({
    signature,
    timestamp,
    apiKey: API_KEY,
    cloudName: CLOUD_NAME,
    folder: cloudFolder,
    publicId,
    tags: body.tags ?? null,
  });
}
