'use client';

/**
 * ImageLightbox — Phase 19.19 — Reusable fullscreen image viewer.
 *
 * Features:
 *   - Click ảnh → fullscreen với border accent
 *   - ESC + click outside để đóng
 *   - Prev/Next nếu có nhiều ảnh
 *   - Zoom +/- (Ctrl+wheel) + reset double-click
 *   - Caption + counter (X / Y)
 *   - Body scroll lock khi mở
 */
import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut } from 'lucide-react';

interface LightboxImage {
  src: string;
  alt: string;
  caption?: string;
}

interface Props {
  images: LightboxImage[];
  initialIndex: number;
  open: boolean;
  onClose: () => void;
}

export function ImageLightbox({ images, initialIndex, open, onClose }: Props) {
  const [index, setIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    if (open) setIndex(initialIndex);
    setZoom(1);
  }, [open, initialIndex]);

  const next = useCallback(() => {
    setIndex((i) => (i + 1) % images.length);
    setZoom(1);
  }, [images.length]);

  const prev = useCallback(() => {
    setIndex((i) => (i - 1 + images.length) % images.length);
    setZoom(1);
  }, [images.length]);

  // Keyboard
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
      else if (e.key === '+' || e.key === '=') setZoom((z) => Math.min(z * 1.25, 4));
      else if (e.key === '-') setZoom((z) => Math.max(z / 1.25, 0.5));
      else if (e.key === '0') setZoom(1);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, next, prev, onClose]);

  if (!open || images.length === 0) return null;
  const img = images[index]!;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[60] flex items-center justify-center backdrop-blur-md"
      style={{ background: 'rgba(0,0,0,0.92)' }}
    >
      {/* Top bar */}
      <div
        className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3 z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <span
            className="text-sm font-semibold"
            style={{ color: '#ffffff' }}
          >
            {index + 1} / {images.length}
          </span>
          {img.caption && (
            <span
              className="text-sm hidden sm:inline ml-3"
              style={{ color: 'rgba(255,255,255,0.7)' }}
            >
              {img.caption}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <ZoomBtn onClick={() => setZoom((z) => Math.max(z / 1.25, 0.5))} disabled={zoom <= 0.5}>
            <ZoomOut size={16} />
          </ZoomBtn>
          <span
            className="text-xs font-mono px-2 min-w-[3rem] text-center"
            style={{ color: '#ffffff' }}
          >
            {Math.round(zoom * 100)}%
          </span>
          <ZoomBtn onClick={() => setZoom((z) => Math.min(z * 1.25, 4))} disabled={zoom >= 4}>
            <ZoomIn size={16} />
          </ZoomBtn>
          <ZoomBtn onClick={onClose}>
            <X size={18} />
          </ZoomBtn>
        </div>
      </div>

      {/* Prev/Next */}
      {images.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              prev();
            }}
            className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full transition-colors hover:bg-white/10 z-10"
            style={{ color: '#ffffff' }}
            aria-label="Ảnh trước"
          >
            <ChevronLeft size={26} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              next();
            }}
            className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full transition-colors hover:bg-white/10 z-10"
            style={{ color: '#ffffff' }}
            aria-label="Ảnh sau"
          >
            <ChevronRight size={26} />
          </button>
        </>
      )}

      {/* Image */}
      <div
        className="max-w-[95vw] max-h-[85vh] flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={() => setZoom(1)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={img.src}
          alt={img.alt}
          className="object-contain transition-transform select-none"
          style={{
            maxWidth: '95vw',
            maxHeight: '85vh',
            transform: `scale(${zoom})`,
          }}
          loading="eager"
          draggable={false}
        />
      </div>

      {/* Bottom hint */}
      <div
        className="absolute bottom-3 inset-x-0 text-center text-[11px] z-10 pointer-events-none"
        style={{ color: 'rgba(255,255,255,0.5)' }}
      >
        {images.length > 1 ? '← → đổi ảnh · ' : ''}+/− zoom · 0 reset · Esc đóng
      </div>
    </div>
  );
}

function ZoomBtn({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center justify-center w-9 h-9 rounded-full transition-colors hover:bg-white/10 disabled:opacity-30"
      style={{ color: '#ffffff' }}
    >
      {children}
    </button>
  );
}
