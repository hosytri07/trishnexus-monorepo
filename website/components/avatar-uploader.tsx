'use client';

/**
 * AvatarUploader — Phase 19.12 (migrated to Cloudinary).
 *
 * Trước: Firebase Storage. Sau: Cloudinary với auto-resize qua URL transform.
 * Lý do: 1 ảnh upload → N kích thước (32/64/128/256) khác nhau cho từng nơi
 * dùng (sidebar, profile, comments) mà không phải resize trước upload.
 *
 * Lưu vào Firestore field `users/{uid}.cloudinary_avatar_id` (publicId).
 * Field cũ `photo_url` vẫn giữ để fallback nếu chưa migrate.
 */
import { useState } from 'react';
import { Trash2, User } from 'lucide-react';
import { doc, updateDoc, deleteField } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';
import { CloudinaryUploader } from './cloudinary-uploader';
import { CloudinaryImage } from './cloudinary-image';
import { buildImageUrl } from '@/lib/cloudinary';

interface Props {
  uid: string;
  /** Cloudinary public_id (mới) — ưu tiên dùng */
  avatarId?: string | null;
  /** Legacy URL từ Firebase Storage / Google sign-in */
  photoUrl?: string;
  size?: number;
}

export function AvatarUploader({ uid, avatarId, photoUrl, size = 96 }: Props) {
  const { refreshProfile } = useAuth();
  const [busyDelete, setBusyDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasAvatar = Boolean(avatarId || photoUrl);

  async function handleUpload(result: { publicId: string; url: string }) {
    setError(null);
    if (!db) {
      setError('Firestore chưa cấu hình');
      return;
    }
    try {
      await updateDoc(doc(db, 'users', uid), {
        cloudinary_avatar_id: result.publicId,
        photo_url: buildImageUrl(result.publicId, 'avatar-256'),
      });
      await refreshProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lưu Firestore thất bại');
    }
  }

  async function handleRemove() {
    if (!hasAvatar) return;
    if (!window.confirm('Xoá avatar?')) return;
    setBusyDelete(true);
    setError(null);
    try {
      if (db) {
        await updateDoc(doc(db, 'users', uid), {
          cloudinary_avatar_id: deleteField(),
          photo_url: deleteField(),
        });
      }
      // Note: chưa xoá file Cloudinary qua API (cần signed delete) — Cloudinary
      // sẽ dọn temp file expired. Avatar overwrite cùng publicId nên không tốn quota.
      await refreshProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xoá thất bại');
    } finally {
      setBusyDelete(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      {/* Avatar preview */}
      <div
        className="shrink-0 rounded-full overflow-hidden relative"
        style={{
          width: size,
          height: size,
          background: 'var(--color-surface-muted)',
          border: '2px solid var(--color-border-default)',
        }}
      >
        {avatarId ? (
          <CloudinaryImage
            publicId={avatarId}
            preset="avatar-256"
            alt="Avatar"
            className="w-full h-full object-cover"
            loading="eager"
          />
        ) : photoUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={photoUrl}
            alt="Avatar"
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <User
            size={size * 0.5}
            strokeWidth={1.5}
            className="absolute inset-0 m-auto"
            style={{ color: 'var(--color-text-muted)' }}
          />
        )}
      </div>

      {/* Buttons */}
      <div className="flex flex-col gap-1.5">
        <CloudinaryUploader
          folder="avatar"
          onUpload={handleUpload}
          maxSizeMB={10}
        />
        {hasAvatar && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={busyDelete}
            className="inline-flex items-center gap-1.5 px-3 h-8 rounded-md text-xs font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}
          >
            <Trash2 size={11} />
            {busyDelete ? 'Đang xoá…' : 'Xoá avatar'}
          </button>
        )}
        {error && (
          <div className="text-[11px]" style={{ color: '#EF4444' }}>
            ⚠ {error}
          </div>
        )}
        <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
          PNG/JPG max 10MB · auto resize 256×256
        </p>
      </div>
    </div>
  );
}
