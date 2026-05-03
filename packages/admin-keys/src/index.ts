/**
 * @trishteam/admin-keys — Public exports.
 *
 * Phase 28.8 (2026-05-03).
 *
 * Use:
 *   // TrishAdmin (admin UI):
 *   import { saveApiKey, loadAllApiKeys, loadAuditLog } from '@trishteam/admin-keys';
 *
 *   // TrishDesign (consumer app):
 *   import { subscribeApiKeys, resolveTenantId } from '@trishteam/admin-keys';
 *   const tenant = resolveTenantId(profile);
 *   const unsub = subscribeApiKeys(tenant, (keys) => {
 *     localStorage.setItem('trishdesign:groq-api-key', keys.groq);
 *     localStorage.setItem('trishdesign:claude-api-key', keys.claude);
 *   });
 */

export { encryptApiKey, decryptApiKey } from './crypto.js';

export {
  type ApiKeyProvider,
  type ApiKeyDoc,
  type AuditLogEntry,
  ALL_PROVIDERS,
  DEFAULT_PROVIDERS,
  FEEDBACK_PROVIDERS,
  PROVIDER_LABEL,
  PROVIDER_PLACEHOLDER,
  PROVIDER_FREE,
  adminKeyPaths,
  saveApiKey,
  loadApiKey,
  loadAllApiKeys,
  loadApiKeyMeta,
  subscribeApiKeys,
  loadAuditLog,
} from './firestore.js';

export {
  DEFAULT_TENANT_ID,
  resolveTenantId,
  setActiveTenantId,
  getActiveTenantId,
  validateTenantId,
} from './tenant.js';

export {
  type LispLibraryEntry,
  LISP_CATEGORIES,
  lispLibraryPaths,
  listLispLibrary,
  subscribeLispLibrary,
  addLispLibraryEntry,
  updateLispLibraryEntry,
  deleteLispLibraryEntry,
} from './lisp-library.js';

export { LISP_LIBRARY_PROVIDERS } from './firestore.js';
