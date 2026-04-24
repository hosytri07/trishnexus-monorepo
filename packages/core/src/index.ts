/**
 * @trishteam/core — root public API.
 *
 * Re-export theo sub-module để consumer có thể import cả hai cách:
 *   import { mergeApp } from '@trishteam/core/apps';
 *   import { mergeApp } from '@trishteam/core';
 *
 * Phase 14.0 (2026-04-23).
 */

export * as apps from './apps/index.js';
export * as search from './search/index.js';
export * as notes from './notes/index.js';
export * as qr from './qr/index.js';
export * as clean from './clean/index.js';
export * as fonts from './fonts/index.js';
export * as type from './type/index.js';
export * as images from './images/index.js';
export * as library from './library/index.js';
export * as fulltext from './fulltext/index.js';
export * as design from './design/index.js';

// Flat re-export cho tiện import khi không cần namespace:
export type {
  AppForUi,
  AppMeta,
  AppRegistry,
  AppRegistryEntry,
  AppStatus,
  EcosystemInfo,
  LoginRequired,
  Platform,
  DownloadTarget,
} from './apps/types.js';

export { VERSION } from './version.js';
