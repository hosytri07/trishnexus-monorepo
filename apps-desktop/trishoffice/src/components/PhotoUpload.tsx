/**
 * TrishOffice — Photo Upload component (Phase 38.19).
 *
 * Đọc file ảnh → resize 256×256 max → base64 data URL → callback.
 * Hỗ trợ JPG/PNG/WEBP. File lớn tự nén client-side để không quá 100KB.
 */

import { useRef } from 'react';
import { Camera, X } from 'lucide-react';

interface PhotoUploadProps {
  /** Data URL hiện tại (nếu có ảnh) */
  value?: string;
  onChange: (dataUrl: string | undefined) => void;
  /** Tên hiển thị làm initials nếu chưa có ảnh */
  fallbackName?: string;
  /** Size hiển thị (px) */
  size?: number;
}

export function PhotoUpload({
  value,
  onChange,
  fallbackName,
  size = 80,
}: PhotoUploadProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File): Promise<void> {
    if (!file.type.startsWith('image/')) {
      alert('Vui lòng chọn file ảnh (JPG/PNG/WEBP)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('Ảnh quá lớn (>5MB). Vui lòng chọn ảnh nhỏ hơn.');
      return;
    }

    // Read + resize 256×256 max → JPEG 80% quality (~30-80KB)
    const dataUrl = await resizeToDataUrl(file, 256, 0.8);
    onChange(dataUrl);
  }

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: value
            ? 'transparent'
            : 'var(--color-accent-primary, #10B981)',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: Math.floor(size / 2.5),
          fontWeight: 700,
          overflow: 'hidden',
          position: 'relative',
          border: '2px solid var(--color-border-subtle, #E5E7EB)',
        }}
      >
        {value ? (
          <img
            src={value}
            alt="Avatar"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          (fallbackName ?? '?').charAt(0).toUpperCase()
        )}

        {/* Overlay button */}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: 26,
            height: 26,
            borderRadius: '50%',
            background: 'var(--color-accent-primary, #10B981)',
            color: '#fff',
            border: '2px solid var(--color-surface-card, #fff)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          title="Đổi ảnh"
        >
          <Camera size={12} />
        </button>
      </div>

      {value && (
        <button
          type="button"
          onClick={() => onChange(undefined)}
          style={{
            background: 'none',
            border: 'none',
            color: '#DC2626',
            fontSize: 11,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 3,
          }}
          title="Xóa ảnh"
        >
          <X size={11} /> Xóa ảnh
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          // Reset to allow re-selecting same file
          e.target.value = '';
        }}
      />
    </div>
  );
}

/**
 * Avatar component nhỏ hiển thị ảnh hoặc initials.
 */
export function Avatar({
  src,
  name,
  size = 32,
}: {
  src?: string;
  name?: string;
  size?: number;
}): JSX.Element {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: src ? 'transparent' : 'var(--color-accent-primary, #10B981)',
        color: '#fff',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: Math.floor(size / 2.5),
        fontWeight: 700,
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      {src ? (
        <img src={src} alt={name ?? 'Avatar'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        (name ?? '?').charAt(0).toUpperCase()
      )}
    </div>
  );
}

/**
 * Resize ảnh xuống maxSize × maxSize → JPEG dataURL.
 */
function resizeToDataUrl(file: File, maxSize: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Đọc file lỗi'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Decode ảnh lỗi'));
      img.onload = () => {
        const ratio = Math.min(maxSize / img.width, maxSize / img.height, 1);
        const w = Math.round(img.width * ratio);
        const h = Math.round(img.height * ratio);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context null'));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
