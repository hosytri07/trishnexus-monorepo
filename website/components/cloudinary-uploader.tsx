'use client';

/**
 * CloudinaryUploader — Phase 19.12.
 *
 * Upload widget chung cho mọi loại ảnh:
 *   - Avatar (folder='avatar', publicId=uid → overwrite)
 *   - Sign/Bridge/Post (admin only, folder ép server-side)
 *
 * Flow:
 *   1. User pick file
 *   2. Frontend gọi /api/cloudinary/sign với Firebase ID token
 *   3. Server verify token + role, trả signature
 *   4. Client POST file + signed params → api.cloudinary.com
 *   5. Cloudinary return secure_url + public_id
 *   6. Callback onUpload({ publicId, url }) cho parent
 *
 * Validation client:
 *   - Chỉ image
 *   - Max size 10MB raw (Cloudinary tự resize sau)
 */
import { useRef, useState } from 'react';
import { Camera, Loader2, Upload, X } from 'lucide-react';
import { auth } from '@/lib/firebase';
import type { CloudinaryFolder } from '@/lib/cloudinary';

interface SignedParams {
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  folder: string;
  publicId: string | null;
  tags: string | null;
}

interface UploadResult {
  publicId: string;
  url: string;
  bytes: number;
  width: number;
  height: number;
  format: string;
}

interface Props {
  folder: CloudinaryFolder;
  publicId?: string;
  tags?: string;
  onUpload: (result: UploadResult) => void | Promise<void>;
  /** Optional: max file size MB. Default 10. */
  maxSizeMB?: number;
  /** Custom render for trigger area (default = button) */
  children?: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

export function CloudinaryUploader({
  folder,
  publicId,
  tags,
  onUpload,
  maxSizeMB = 10,
  children,
  className,
  disabled,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  async function handleFile(file: File) {
    setError(null);
    if (!file.type.startsWith('image/')) {
      setError('File không phải ảnh');
      return;
    }
    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(`Quá lớn (max ${maxSizeMB} MB)`);
      return;
    }
    if (!auth?.currentUser) {
      setError('Bạn cần đăng nhập trước');
      return;
    }
    setBusy(true);
    setProgress(0);
    try {
      // 1. Get signed params
      const idToken = await auth.currentUser.getIdToken();
      const signRes = await fetch('/api/cloudinary/sign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ folder, publicId, tags }),
      });
      if (!signRes.ok) {
        const errBody = await signRes.json().catch(() => ({}));
        throw new Error(errBody.error ?? `Sign fail (${signRes.status})`);
      }
      const signed: SignedParams = await signRes.json();

      // 2. Upload to Cloudinary với XHR để track progress
      const formData = new FormData();
      formData.append('file', file);
      formData.append('api_key', signed.apiKey);
      formData.append('timestamp', String(signed.timestamp));
      formData.append('signature', signed.signature);
      formData.append('folder', signed.folder);
      if (signed.publicId) formData.append('public_id', signed.publicId);
      if (signed.tags) formData.append('tags', signed.tags);

      const result = await uploadXhr(
        `https://api.cloudinary.com/v1_1/${signed.cloudName}/image/upload`,
        formData,
        (pct) => setProgress(pct),
      );

      // 3. Callback
      await onUpload({
        publicId: result.public_id,
        url: result.secure_url,
        bytes: result.bytes,
        width: result.width,
        height: result.height,
        format: result.format,
      });
      setProgress(100);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload thất bại');
    } finally {
      setBusy(false);
      setTimeout(() => setProgress(0), 1500);
    }
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (f) void handleFile(f);
  }

  function onDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) void handleFile(f);
  }

  return (
    <div className={className}>
      <label
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        className="cursor-pointer inline-block"
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={onPick}
          disabled={busy || disabled}
          className="hidden"
        />
        {children ?? (
          <span
            className="inline-flex items-center gap-2 px-4 h-10 rounded-md text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{
              background: 'var(--color-accent-soft)',
              color: 'var(--color-accent-primary)',
              border: '1px solid var(--color-accent-primary)',
            }}
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {busy ? `Đang tải… ${progress}%` : 'Chọn ảnh để tải lên'}
          </span>
        )}
      </label>

      {/* Progress bar inline */}
      {busy && progress > 0 && (
        <div
          className="mt-2 h-1 rounded-full overflow-hidden"
          style={{ background: 'var(--color-surface-bg_elevated)' }}
        >
          <div
            className="h-full transition-all"
            style={{
              width: `${progress}%`,
              background: 'var(--color-accent-gradient)',
            }}
          />
        </div>
      )}

      {error && (
        <div
          className="inline-flex items-center gap-1 mt-2 text-xs"
          style={{ color: '#EF4444' }}
        >
          <X size={11} /> {error}
        </div>
      )}
    </div>
  );
}

/** Wrap XHR để track upload progress (fetch chưa support upload progress). */
function uploadXhr(
  url: string,
  formData: FormData,
  onProgress: (pct: number) => void,
): Promise<{
  public_id: string;
  secure_url: string;
  bytes: number;
  width: number;
  height: number;
  format: string;
}> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          reject(new Error('Cloudinary response không phải JSON'));
        }
      } else {
        reject(new Error(`Cloudinary upload fail (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error('Network error'));
    xhr.send(formData);
  });
}

// Re-export icon for caller convenience
export { Camera as CameraIcon } from 'lucide-react';
