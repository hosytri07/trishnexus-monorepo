'use client';

/**
 * CloudinaryImage — Phase 19.12 — wrapper hiển thị ảnh từ Cloudinary publicId.
 *
 * Props:
 *   - publicId: ID lưu trong Firestore (vd 'trishteam/avatars/dOio23')
 *               hoặc full URL (legacy fallback)
 *   - preset:   transformation preset (avatar-256, sign-thumb, post-hero, ...)
 *   - alt:      bắt buộc cho a11y
 *   - className / style: tuỳ biến UI
 *   - fallback: nếu publicId rỗng — hiển thị element thay (vd avatar initials)
 */
import { buildImageUrl, type CloudinaryPreset } from '@/lib/cloudinary';

interface Props {
  publicId?: string | null;
  preset?: CloudinaryPreset;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
  fallback?: React.ReactNode;
  /** Loading strategy. Default = 'lazy'. Hero ở fold trên dùng 'eager'. */
  loading?: 'eager' | 'lazy';
  /** Width/height hint giúp browser reserve space (CLS) */
  width?: number;
  height?: number;
}

export function CloudinaryImage({
  publicId,
  preset = 'original',
  alt,
  className,
  style,
  fallback,
  loading = 'lazy',
  width,
  height,
}: Props) {
  if (!publicId) {
    if (fallback) return <>{fallback}</>;
    return null;
  }
  const src = buildImageUrl(publicId, preset);
  /* eslint-disable-next-line @next/next/no-img-element */
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      style={style}
      loading={loading}
      width={width}
      height={height}
      referrerPolicy="no-referrer"
    />
  );
}
