/**
 * TrishSearch — Frontend OCR engine.
 *
 * Phase 17.3 Layer 3 (v2.0.0-1):
 *   - PDF.js render PDF page → canvas → ImageData
 *   - Tesseract.js OCR canvas → text (Vietnamese + English)
 *   - Pure WASM/JS, không cần FFI/native binary, license Apache 2.0
 *
 * Hạn chế: chậm hơn native ~3-5×, tốn RAM webview (~300-500MB lúc OCR).
 * Đổi lại: zero FFI, offline, Vietnamese support cực ổn.
 *
 * Vietnamese model + Tesseract worker được bundle vào public/tess/
 * (xem scripts/download-ocr-assets.ps1).
 */

import { createWorker, type Worker } from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist';

// PDF.js worker URL — Vite handles bundling via ?url import.
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export type OcrLanguage = 'vie' | 'eng' | 'vie+eng';

export interface OcrProgress {
  stage: 'init' | 'loading-model' | 'rendering' | 'recognizing' | 'done' | 'error';
  message: string;
  progress: number; // 0-100
  page?: number;
  totalPages?: number;
}

export type OcrProgressHandler = (progress: OcrProgress) => void;

/** Cap số trang PDF mỗi lần OCR — tránh OCR PDF dày 500 trang mất 1 giờ. */
const PDF_MAX_PAGES = 50;
/** Render scale (2.0 ≈ 144 DPI — đủ độ nét cho OCR, không quá nặng). */
const PDF_RENDER_SCALE = 2.0;

class OcrEngine {
  private worker: Worker | null = null;
  private currentLang: OcrLanguage | null = null;
  private workerInitPromise: Promise<Worker> | null = null;

  /**
   * Lazy init Tesseract worker, cache cross-call.
   * Nếu đổi ngôn ngữ → terminate cũ, tạo worker mới.
   */
  private async ensureWorker(
    lang: OcrLanguage,
    onProgress?: OcrProgressHandler,
  ): Promise<Worker> {
    if (this.worker && this.currentLang === lang) {
      return this.worker;
    }
    if (this.worker) {
      try {
        await this.worker.terminate();
      } catch {
        /* ignore */
      }
      this.worker = null;
    }
    if (this.workerInitPromise) {
      return this.workerInitPromise;
    }

    onProgress?.({
      stage: 'loading-model',
      message: `Đang tải model Tesseract (${lang})…`,
      progress: 0,
    });

    this.workerInitPromise = (async () => {
      // Bundle assets ở public/tess/ — copy bởi scripts/download-ocr-assets.ps1
      const worker = await createWorker(lang, 1, {
        workerPath: '/tess/worker.min.js',
        langPath: '/tess/tessdata',
        corePath: '/tess/tesseract-core-simd.wasm.js',
        gzip: true,
        logger: (m) => {
          if (m.status === 'recognizing text') {
            onProgress?.({
              stage: 'recognizing',
              message: 'Đang nhận diện text…',
              progress: Math.round(m.progress * 100),
            });
          } else if (m.status === 'loading language traineddata') {
            onProgress?.({
              stage: 'loading-model',
              message: `Đang tải traineddata (${Math.round(m.progress * 100)}%)…`,
              progress: Math.round(m.progress * 100),
            });
          }
        },
      });
      this.currentLang = lang;
      this.worker = worker;
      this.workerInitPromise = null;
      return worker;
    })();

    return this.workerInitPromise;
  }

  /** OCR 1 ảnh (Blob hoặc Uint8Array) → text. */
  async ocrImage(
    imageData: Blob | Uint8Array,
    lang: OcrLanguage,
    onProgress?: OcrProgressHandler,
  ): Promise<string> {
    onProgress?.({
      stage: 'init',
      message: 'Khởi động Tesseract worker…',
      progress: 0,
    });
    const worker = await this.ensureWorker(lang, onProgress);
    const blob =
      imageData instanceof Blob
        ? imageData
        : new Blob([imageData], { type: 'image/png' });
    const result = await worker.recognize(blob);
    onProgress?.({
      stage: 'done',
      message: 'Hoàn tất',
      progress: 100,
    });
    return (result.data.text || '').trim();
  }

  /**
   * OCR 1 PDF: render từng page → ảnh → Tesseract.
   * Cap PDF_MAX_PAGES để tránh treo.
   */
  async ocrPdf(
    pdfBytes: Uint8Array,
    lang: OcrLanguage,
    onProgress?: OcrProgressHandler,
  ): Promise<string> {
    onProgress?.({
      stage: 'init',
      message: 'Đang đọc PDF…',
      progress: 0,
    });

    const pdf = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
    const totalPages = pdf.numPages;
    const pagesToOcr = Math.min(totalPages, PDF_MAX_PAGES);

    const worker = await this.ensureWorker(lang, onProgress);

    let combined = '';

    for (let i = 1; i <= pagesToOcr; i++) {
      onProgress?.({
        stage: 'rendering',
        message: `Render page ${i}/${pagesToOcr}…`,
        progress: Math.round(((i - 1) / pagesToOcr) * 100),
        page: i,
        totalPages: pagesToOcr,
      });

      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: PDF_RENDER_SCALE });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Không tạo được canvas 2D context');
      }

      await page.render({ canvasContext: ctx, viewport }).promise;

      onProgress?.({
        stage: 'recognizing',
        message: `OCR page ${i}/${pagesToOcr}…`,
        progress: Math.round(((i - 0.5) / pagesToOcr) * 100),
        page: i,
        totalPages: pagesToOcr,
      });

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), 'image/png'),
      );
      if (!blob) {
        // Cleanup canvas + skip
        canvas.width = 0;
        canvas.height = 0;
        continue;
      }

      try {
        const result = await worker.recognize(blob);
        const pageText = (result.data.text || '').trim();
        if (pageText) {
          combined += `--- Trang ${i} ---\n${pageText}\n\n`;
        }
      } catch (err) {
        console.warn(`[ocr] page ${i} fail:`, err);
      }

      // Free canvas memory ngay
      canvas.width = 0;
      canvas.height = 0;

      // Cleanup PDF.js page
      page.cleanup();
    }

    if (totalPages > PDF_MAX_PAGES) {
      combined += `\n[⚠ Cap ${PDF_MAX_PAGES} trang OCR — file gốc có ${totalPages} trang]\n`;
    }

    // Cleanup PDF.js document
    await pdf.destroy();

    onProgress?.({
      stage: 'done',
      message: 'Hoàn tất',
      progress: 100,
    });

    return combined.trim();
  }

  /** Giải phóng worker khi không dùng (vd app close). */
  async destroy(): Promise<void> {
    if (this.worker) {
      try {
        await this.worker.terminate();
      } catch {
        /* ignore */
      }
      this.worker = null;
      this.currentLang = null;
    }
  }
}

// Singleton
let _instance: OcrEngine | null = null;

export function getOcrEngine(): OcrEngine {
  if (!_instance) _instance = new OcrEngine();
  return _instance;
}

/** Detect ext nào có thể OCR. */
export function isOcrCandidate(ext: string): boolean {
  const e = ext.toLowerCase();
  return (
    e === 'pdf' ||
    e === 'jpg' ||
    e === 'jpeg' ||
    e === 'png' ||
    e === 'bmp' ||
    e === 'tiff' ||
    e === 'tif'
  );
}
