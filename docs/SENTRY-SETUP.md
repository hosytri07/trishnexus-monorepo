# Sentry crash reporter — setup guide

**Phase 21 prep · 2026-04-29**

Telemetry tự host của TrishTEAM (`@trishteam/telemetry`) đã ghi mọi error vào Firestore `/errors/{env}/samples/`. Sentry là **lớp thứ 2** — group, alert, release tracking, breadcrumbs trail tự động — free tier 5k event/tháng.

> **Tóm tắt**: Nếu `@trishteam/telemetry` đã đủ cho nhu cầu hiện tại (Trí xem Errors panel TrishAdmin), có thể skip Sentry. Khi traffic tăng, wire Sentry để có alert tự động.

## Bước 1 — Tạo account + project Sentry

1. Đăng ký tại https://sentry.io/signup/ (free tier developer plan)
2. Tạo organization "trishteam"
3. Tạo project cho từng app:
   - `trishteam-website` (platform: Next.js)
   - `trishteam-launcher` (platform: JavaScript)
   - `trishteam-library` (platform: JavaScript)
   - `trishteam-admin` (platform: JavaScript)
   - `trishteam-font` (platform: JavaScript)
   - `trishteam-check` (platform: JavaScript)
   - `trishteam-clean` (platform: JavaScript)
   - `trishteam-design` (platform: JavaScript)
4. Mỗi project → Settings → Client Keys → copy DSN (dạng `https://<key>@<org>.ingest.sentry.io/<project-id>`)

## Bước 2 — Thêm DSN vào env

### Website (Vercel)
Vercel project → Settings → Environment Variables → New:
- `NEXT_PUBLIC_SENTRY_DSN` = DSN của project `trishteam-website`

Redeploy.

### Desktop apps
Mỗi app `apps-desktop/<app>/src-tauri/tauri.conf.json` thêm:
```json
"productName": "TrishLibrary",
"app": {
  "windows": [{ ... }],
  "security": {
    "csp": "..."
  }
},
"plugins": {
  "envVars": {
    "TRISHTEAM_SENTRY_DSN": "https://...@.../..."
  }
}
```

Hoặc đơn giản hơn — hard-code DSN vào file `src/sentry.ts` của mỗi app (DSN không phải secret nhưng vẫn nên dùng env var nếu có CI).

## Bước 3 — Cài Sentry SDK

### Website (Next.js)
```bash
cd website
pnpm add @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

Wizard tự tạo `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`, instrumentation.

### Desktop apps
```bash
cd apps-desktop/trishlibrary  # và lặp lại 6 app khác
pnpm add @sentry/browser @sentry/integrations
```

## Bước 4 — Wire vào @trishteam/telemetry

Update `packages/telemetry/src/browser.ts` để gửi đồng thời tới Sentry + Firestore:

```ts
import * as Sentry from '@sentry/browser';

let sentryInited = false;

export function initSentry(dsn: string, app: string, version: string): void {
  if (sentryInited) return;
  Sentry.init({
    dsn,
    release: `${app}@${version}`,
    tracesSampleRate: 0.1, // 10% transaction
    replaysSessionSampleRate: 0, // tắt session replay (tốn quota)
    replaysOnErrorSampleRate: 1.0, // chỉ replay khi error
    integrations: [], // không dùng auto Browser*
  });
  sentryInited = true;
}

// Trong reportError(), thêm:
export function reportError(payload: ErrorPayload): void {
  // ... existing code Firestore write ...

  // Send to Sentry
  if (sentryInited) {
    Sentry.captureException(new Error(`${payload.name}: ${payload.message}`), {
      level: payload.severity === 'fatal' ? 'fatal' : payload.severity === 'warning' ? 'warning' : 'error',
      tags: { app: payload.app, version: payload.version, platform: payload.platform },
      contexts: payload.context ? { custom: payload.context } : undefined,
      user: payload.uid ? { id: payload.uid } : undefined,
    });
  }
}
```

Update `installTauriTelemetry()` thêm param `sentryDsn` (optional).

## Bước 5 — Smoke test

1. Mở 1 app (vd TrishLauncher dev)
2. Throw 1 error giả: console → `throw new Error('test sentry');`
3. Vào Sentry dashboard → project trishteam-launcher → thấy error mới sau ~30s

## Quotas + alert

- **Free tier**: 5,000 errors / 10,000 transactions / 50 replays per month
- Sentry → Alerts → New alert rule:
  - "When event count > 100 in 1 hour" → email Trí
  - "Issue is regression" → email Trí
- Alert budget: nếu vượt quota, Sentry auto-dropped event nhưng KHÔNG charge.

## Source maps (cải thiện stack trace)

Optional nhưng khuyến cáo. Cài Sentry CLI:
```bash
pnpm add -D @sentry/cli
```

Trong `package.json` build script:
```json
"build:tauri": "tsc --noEmit && vite build && sentry-cli releases new $npm_package_version && sentry-cli releases files $npm_package_version upload-sourcemaps dist/ && sentry-cli releases finalize $npm_package_version"
```

Cần `SENTRY_AUTH_TOKEN` env (lấy từ Sentry → User Settings → API → Auth Tokens, scope `project:releases`).

## Fallback: skip Sentry

Nếu free tier đủ rồi (5k event/tháng) thì wire. Nếu Trí muốn skip:
- `@trishteam/telemetry` đã đủ ghi error vào Firestore
- Errors panel TrishAdmin desktop hiển thị top 20 issue group theo fingerprint
- Không có alert tự động — Trí phải check thủ công

→ Quyết định khi traffic vượt ~100 user/ngày.
