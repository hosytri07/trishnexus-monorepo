# @trishteam/telemetry

Telemetry chia sẻ cho website + 7 desktop app TrishTEAM. **Phase 21 prep (2026-04-29)**.

Package này gộp logic phân tán trước đây ở `website/lib/error-report.ts` + `components/error-reporter.tsx` + `components/web-vitals-reporter.tsx` thành 1 nơi để 7 desktop app dùng chung.

## API

### Common (`@trishteam/telemetry`)
- `ErrorPayload`, `VitalPayload` — type interface
- `sanitizeError`, `sanitizeVital` — cắt size + fill defaults
- `computeFingerprint` — FNV-1a hash dedupe
- `classifyVital` — đánh giá Web Vitals theo ngưỡng chuẩn

### Browser (`@trishteam/telemetry/browser`)
- `reportError(payload)` — POST `/api/errors` (sendBeacon ưu tiên)
- `reportVital(payload)` — POST `/api/vitals`
- `installErrorHandlers({ app, version, uid })` — cài `window.onerror` + `unhandledrejection`
- `setEndpointBase(url)` — override base URL (default same-origin)

### Tauri (`@trishteam/telemetry/tauri`)
- `installTauriTelemetry({ app, version, uid })` — full setup: endpoint = `trishteam.io.vn` + window handlers + Tauri panic listener
- `reportTauriError(app, version, err, context?, uid?)` — manual report cho try/catch
- `reportStartupTime(app, version, ms, uid?)` — báo cold launch time

## Cách dùng

### Website (Next.js)
```tsx
// app/components/error-reporter-client.tsx
'use client';
import { useEffect } from 'react';
import { installErrorHandlers } from '@trishteam/telemetry/browser';

export function ErrorReporterClient() {
  useEffect(() => {
    return installErrorHandlers({
      app: 'website',
      version: process.env.NEXT_PUBLIC_APP_VERSION || '0.0.0',
      uid: () => getCurrentFirebaseUid(),
    });
  }, []);
  return null;
}
```

### Desktop app (Tauri 2)
```ts
// src/main.tsx
import { installTauriTelemetry } from '@trishteam/telemetry/tauri';
import packageJson from '../package.json';

installTauriTelemetry({
  app: 'trishlibrary',
  version: packageJson.version,
  uid: () => firebase.auth().currentUser?.uid,
}).catch(console.error);
```

### Rust panic hook (src-tauri/src/lib.rs)
```rust
use serde::Serialize;
use tauri::Emitter;

#[derive(Clone, Serialize)]
struct PanicPayload {
    message: String,
    location: String,
    thread: String,
}

pub fn setup_panic_hook(app_handle: tauri::AppHandle) {
    std::panic::set_hook(Box::new(move |info| {
        let payload = PanicPayload {
            message: info.payload().downcast_ref::<&str>().map(|s| s.to_string())
                .or_else(|| info.payload().downcast_ref::<String>().cloned())
                .unwrap_or_else(|| "panic (no message)".to_string()),
            location: info.location().map(|l| format!("{}:{}", l.file(), l.line()))
                .unwrap_or_else(|| "unknown".to_string()),
            thread: std::thread::current().name().unwrap_or("unnamed").to_string(),
        };
        let _ = app_handle.emit("trishteam://panic", payload);
    }));
}
```

## Server endpoint

Đã có sẵn (Phase 16.3 + 16.5):
- `POST /api/errors` — sanitize + Admin SDK write `/errors/{env}/samples/{auto-id}`
- `POST /api/vitals` — sanitize + Admin SDK write `/vitals/{env}/samples/{auto-id}`

Firestore rules:
- `/errors/{env}/samples/{*}` — client write=deny, admin read
- `/vitals/{env}/samples/{*}` — client write=deny, admin read

## Admin UI

- `/admin/errors` (web) — group theo fingerprint, top 20 issue + 300 sample gần nhất
- `/admin/vitals` (web) — metric card LCP/INP/CLS/TTFB/FCP/FID + percentile + top 15 path
- TrishAdmin desktop — `ErrorsPanel.tsx` + `VitalsPanel.tsx` (Phase 21 prep — đang làm)
