# TrishFinance — public assets cho PWA

Folder này chứa static assets cần ship cho web build (PWA).

## Files cần Trí tạo TRƯỚC khi build web

PWA Android cần 2 icon kích thước cố định:

- **`logo-192.png`** — 192×192px, format PNG, dùng cho favicon + Android home screen
- **`logo-512.png`** — 512×512px, format PNG, dùng cho splash screen + maskable icon

### Cách tạo (1 trong 3):

1. **Online tool nhanh nhất**: [maskable.app/editor](https://maskable.app/editor) → upload `src/assets/logo.png` → resize + export 192 và 512.

2. **ImageMagick (terminal)**:
   ```
   magick src/assets/logo.png -resize 192x192 public/logo-192.png
   magick src/assets/logo.png -resize 512x512 public/logo-512.png
   ```

3. **Photoshop / GIMP**: open `src/assets/logo.png` → Image Size → 192 hoặc 512 → Save As PNG.

## Lưu ý
- Phải là **PNG** (không phải JPG hay WebP)
- Background của icon nên có padding ~10% để hiển thị đẹp khi maskable
- Sau khi tạo xong → `pnpm build:web` để generate `dist-web/` deploy Vercel
