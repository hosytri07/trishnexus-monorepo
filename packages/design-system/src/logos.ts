/**
 * Phase 44.10 — Export 4 logo PNG URLs để package khác import.
 *
 * design-system/AppLogo dùng PNG bằng import trực tiếp (file:// trong build).
 * Package khác (auth/LoginScreen) import URLs qua entry chính:
 *
 *   import { APP_LOGO_PNG_URLS } from '@trishteam/design-system';
 *   <img src={APP_LOGO_PNG_URLS.work} />
 */

import logoWork      from './assets/logo-work.png';
import logoUtilities from './assets/logo-utilities.png';
import logoFinance   from './assets/logo-finance.png';
import logoAdmin     from './assets/logo-admin.png';

export const APP_LOGO_PNG_URLS = {
  work:      logoWork,
  utilities: logoUtilities,
  finance:   logoFinance,
  admin:     logoAdmin,
} as const;
