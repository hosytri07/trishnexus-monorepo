'use client';

/**
 * lib/storage.ts — Phase 19.11 — Firebase Storage wrapper.
 *
 * Chỉ wrap những thao tác phổ biến: upload avatar, upload temp image.
 *
 * Tối ưu:
 *   - Resize avatar về 256×256 client-side TRƯỚC upload (giảm 90% bandwidth).
 *   - Upload Blob trực tiếp (không cần FormData / multipart).
 *   - Trả về downloadURL persistent (không expire).
 *
 * Storage rules (xem `storage.rules`):
 *   - avatars/{uid}.jpg → owner write, public read
 *   - temp/{uid}/{filename} → owner CRUD
 */
import { getApp } from 'firebase/app';
import {
  deleteObject,
  getDownloadURL,
  getStorage,
  ref,
  uploadBytes,
  type FirebaseStorage,
} from 'firebase/storage';
import { firebaseReady } from './firebase';

let _storage: FirebaseStorage | null = null;

function getStorageOrThrow(): FirebaseStorage {
  if (!firebaseReady) throw new Error('Firebase chưa cấu hình');
  if (!_storage) _storage = getStorage(getApp());
  return _storage;
}

/**
 * Resize ảnh về kích thước max (giữ aspect ratio) qua canvas.
 * Trả về Blob JPEG q=0.85.
 */
export async function resizeImage(
  file: File,
  maxDim = 512,
  quality = 0.85,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const ratio = Math.min(maxDim / img.width, maxDim / img.height, 1);
      const w = Math.round(img.width * ratio);
      const h = Math.round(img.height * ratio);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas 2D context unavailable'));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Canvas toBlob fail'));
        },
        'image/jpeg',
        quality,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Không decode được ảnh'));
    };
    img.src = url;
  });
}

/**
 * Upload avatar:
 * 1. Resize 256×256
 * 2. Upload tới `avatars/{uid}.jpg`
 * 3. Trả về download URL public
 */
export async function uploadAvatar(uid: string, file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('File không phải ảnh');
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('File quá lớn (max 10MB trước resize)');
  }
  const blob = await resizeImage(file, 256, 0.9);
  const storage = getStorageOrThrow();
  const r = ref(storage, `avatars/${uid}.jpg`);
  await uploadBytes(r, blob, {
    contentType: 'image/jpeg',
    cacheControl: 'public, max-age=86400', // 1 day cache
  });
  return await getDownloadURL(r);
}

/**
 * Xóa avatar (khi user remove ảnh).
 */
export async function deleteAvatar(uid: string): Promise<void> {
  const storage = getStorageOrThrow();
  try {
    await deleteObject(ref(storage, `avatars/${uid}.jpg`));
  } catch (err) {
    // OK nếu file không tồn tại — vẫn return success
    console.warn('[storage] deleteAvatar fail (có thể chưa có file):', err);
  }
}

/**
 * Upload ảnh tạm (temp) cho user — auto cleanup sau 24h qua Cloud Function.
 * Dùng khi user đang draft post nhưng chưa publish.
 */
export async function uploadTempImage(
  uid: string,
  file: File,
  maxDim = 1200,
): Promise<{ url: string; path: string }> {
  if (!file.type.startsWith('image/')) {
    throw new Error('File không phải ảnh');
  }
  const blob = await resizeImage(file, maxDim, 0.85);
  const ts = Date.now();
  const ext = 'jpg';
  const path = `temp/${uid}/${ts}.${ext}`;
  const storage = getStorageOrThrow();
  const r = ref(storage, path);
  await uploadBytes(r, blob, { contentType: 'image/jpeg' });
  const url = await getDownloadURL(r);
  return { url, path };
}
