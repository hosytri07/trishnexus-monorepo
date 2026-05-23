/**
 * Phase 18.6.a — Module Ảnh types.
 *
 * Simplified domain so we don't need full TrishImage backend (PhotoLocation
 * with persistent state, EXIF, thumbnail cache). We list files on demand
 * and use Tauri's asset protocol cho preview.
 */

export interface ImageFolder {
  id: string;
  name: string;
  path: string;
  added_ms: number;
  recursive: boolean;
}

export interface ImageFile {
  path: string;
  name: string;
  size: number;
  modified_ms: number;
  is_video: boolean;
  ext: string;
}

export type ImageViewMode = 'xl' | 'lg' | 'md' | 'sm' | 'list';

export interface ImageStore {
  folders: ImageFolder[];
  active_folder_id: string | null;
  view_mode: ImageViewMode;
  recursive: boolean;
  /** Per-image notes keyed by absolute path. Used for searching. */
  notes: Record<string, string>;
  /** Per-image logical display name (rename in-app, không đụng file thật). */
  display_names: Record<string, string>;
}

export const DEFAULT_IMAGE_STORE: ImageStore = {
  folders: [],
  active_folder_id: null,
  view_mode: 'md',
  recursive: false,
  notes: {},
  display_names: {},
};
