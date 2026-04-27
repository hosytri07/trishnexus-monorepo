/**
 * Phase 18.6.i — Image lightbox / slideshow.
 *
 * Full-screen viewer:
 *   - Arrow keys ←→ navigate
 *   - Esc đóng
 *   - F toggle fit/cover
 *   - Space toggle auto-play 3s
 *   - Click ngoài ảnh đóng
 *   - Counter X / Y góc trên-trái
 */

import { useEffect, useRef, useState } from 'react';
import type { ImageFile } from './types.js';
import { imageSrcUrl } from './tauri-bridge.js';

interface Props {
  files: ImageFile[];
  initialIndex: number;
  onClose: () => void;
  displayNameOf?: (f: ImageFile) => string;
}

export function ImageLightbox({
  files,
  initialIndex,
  onClose,
  displayNameOf,
}: Props): JSX.Element {
  const [idx, setIdx] = useState(initialIndex);
  const [fit, setFit] = useState<'contain' | 'cover'>('contain');
  const [autoPlay, setAutoPlay] = useState(false);
  const [zoom, setZoom] = useState(1);
  const autoPlayRef = useRef<number | null>(null);

  // Clamp on init
  useEffect(() => {
    setIdx((i) => Math.max(0, Math.min(i, files.length - 1)));
  }, [files.length]);

  function next(): void {
    setIdx((i) => (i + 1) % files.length);
    setZoom(1);
  }
  function prev(): void {
    setIdx((i) => (i - 1 + files.length) % files.length);
    setZoom(1);
  }

  // Auto-play timer
  useEffect(() => {
    if (autoPlay && files.length > 1) {
      autoPlayRef.current = window.setInterval(() => {
        setIdx((i) => (i + 1) % files.length);
        setZoom(1);
      }, 3000);
    } else if (autoPlayRef.current) {
      clearInterval(autoPlayRef.current);
      autoPlayRef.current = null;
    }
    return (): void => {
      if (autoPlayRef.current) clearInterval(autoPlayRef.current);
    };
  }, [autoPlay, files.length]);

  // Keyboard
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          prev();
          break;
        case 'ArrowRight':
          e.preventDefault();
          next();
          break;
        case 'Home':
          e.preventDefault();
          setIdx(0);
          setZoom(1);
          break;
        case 'End':
          e.preventDefault();
          setIdx(files.length - 1);
          setZoom(1);
          break;
        case ' ':
          e.preventDefault();
          setAutoPlay((v) => !v);
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          setFit((v) => (v === 'contain' ? 'cover' : 'contain'));
          break;
        case '+':
        case '=':
          e.preventDefault();
          setZoom((z) => Math.min(z + 0.25, 4));
          break;
        case '-':
          e.preventDefault();
          setZoom((z) => Math.max(z - 0.25, 0.25));
          break;
        case '0':
          e.preventDefault();
          setZoom(1);
          break;
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files.length]);

  if (files.length === 0) return <></>;
  const file = files[idx];
  if (!file) return <></>;
  const displayName = displayNameOf ? displayNameOf(file) : file.name;

  return (
    <div className="image-lightbox" onClick={onClose} role="dialog" aria-label="Image viewer">
      {/* Top bar */}
      <div className="image-lightbox-bar" onClick={(e) => e.stopPropagation()}>
        <span className="image-lightbox-counter">
          <strong>{idx + 1}</strong> / {files.length}
        </span>
        <span className="image-lightbox-name" title={file.path}>
          {displayName}
        </span>
        <span style={{ flex: 1 }} />
        <button
          className={`image-lightbox-btn ${autoPlay ? 'active' : ''}`}
          onClick={() => setAutoPlay((v) => !v)}
          title="Auto-play 3s (Space)"
        >
          {autoPlay ? '⏸' : '▶'}
        </button>
        <button
          className="image-lightbox-btn"
          onClick={() => setFit((v) => (v === 'contain' ? 'cover' : 'contain'))}
          title="Toggle fit/cover (F)"
        >
          {fit === 'contain' ? '⛶' : '⊠'}
        </button>
        <button
          className="image-lightbox-btn"
          onClick={() => setZoom((z) => Math.max(z - 0.25, 0.25))}
          title="Zoom out (-)"
        >
          −
        </button>
        <span className="image-lightbox-zoom">{Math.round(zoom * 100)}%</span>
        <button
          className="image-lightbox-btn"
          onClick={() => setZoom((z) => Math.min(z + 0.25, 4))}
          title="Zoom in (+)"
        >
          +
        </button>
        <button
          className="image-lightbox-btn"
          onClick={() => setZoom(1)}
          title="Reset zoom (0)"
        >
          1:1
        </button>
        <button
          className="image-lightbox-btn"
          onClick={onClose}
          title="Đóng (Esc)"
        >
          ×
        </button>
      </div>

      {/* Main image area */}
      <div className="image-lightbox-stage" onClick={(e) => e.stopPropagation()}>
        {file.is_video ? (
          <video
            src={imageSrcUrl(file.path)}
            controls
            autoPlay
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              transform: `scale(${zoom})`,
              transition: 'transform 0.15s',
            }}
          />
        ) : (
          <img
            src={imageSrcUrl(file.path)}
            alt={displayName}
            style={{
              objectFit: fit,
              transform: `scale(${zoom})`,
              transition: 'transform 0.15s',
            }}
            onDoubleClick={() => setZoom((z) => (z === 1 ? 2 : 1))}
            draggable={false}
          />
        )}
      </div>

      {/* Prev/Next buttons (large clickable areas) */}
      {files.length > 1 && (
        <>
          <button
            className="image-lightbox-nav image-lightbox-nav-prev"
            onClick={(e) => {
              e.stopPropagation();
              prev();
            }}
            title="Trước (←)"
          >
            ‹
          </button>
          <button
            className="image-lightbox-nav image-lightbox-nav-next"
            onClick={(e) => {
              e.stopPropagation();
              next();
            }}
            title="Sau (→)"
          >
            ›
          </button>
        </>
      )}

      {/* Footer hint */}
      <div className="image-lightbox-hint" onClick={(e) => e.stopPropagation()}>
        <kbd>←</kbd> <kbd>→</kbd> chuyển · <kbd>Space</kbd> auto · <kbd>F</kbd> fit ·{' '}
        <kbd>+</kbd>/<kbd>−</kbd>/<kbd>0</kbd> zoom · <kbd>Esc</kbd> thoát
      </div>
    </div>
  );
}
