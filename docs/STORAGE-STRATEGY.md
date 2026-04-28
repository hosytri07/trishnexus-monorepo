# TrishTEAM — Storage Strategy v2

**Phase 19.12 — Cloudinary primary**

## Quyết định kiến trúc

Sau khi đánh giá yêu cầu của user (admin upload ảnh raw vài MB, hệ thống tự
resize / format / serve, free + ổn định), chuyển sang **Cloudinary** làm
storage chính cho mọi ảnh user-uploaded.

```
┌──────────────────────────────────────────────────────────────┐
│  Tier 1 — CLOUDINARY (storage chính, 25 GB free)             │
│  → Avatar · Biển báo · Cầu · Hero blog · Inline blog         │
│  → Auto-resize qua URL transform (1 ảnh upload → N kích thước)│
│  → Auto WebP/AVIF format theo browser                        │
│  → CDN Akamai global                                         │
├──────────────────────────────────────────────────────────────┤
│  Tier 2 — Vercel /public/ (static SVG, FREE vô hạn)          │
│  → Logo app · Brand assets · SVG vector biển báo (giữ nét)   │
├──────────────────────────────────────────────────────────────┤
│  Tier 3 — YouTube/Vimeo embed (FREE)                         │
│  → Video bài blog                                            │
└──────────────────────────────────────────────────────────────┘
```

## Cloudinary free tier (đủ dùng lâu)

| Tài nguyên | Quota | Dự kiến của anh | % dùng |
|---|---|---|---|
| Storage | 25 GB | ~1-2 GB | <8% |
| Bandwidth | 25 GB/tháng | ~5 GB | 20% |
| Transformations | 25,000/tháng | ~10,000 | 40% |
| Upload | unlimited | — | — |

→ Free 100% trong nhiều năm với 1,000-5,000 user.

## Workflow tự động hoá

### Admin upload biển báo

```
1. Admin vào /admin/signs
2. Chọn code biển (vd "P.101")
3. Drop ảnh raw 5MB chụp biển báo thật
   ↓
4. Frontend gọi /api/cloudinary/sign (verify role admin)
   ↓
5. Server trả signed params với folder='sign'
   ↓
6. Frontend POST file → Cloudinary
   ↓
7. Cloudinary lưu nguyên gốc + index, trả public_id
   ↓
8. Lưu publicId vào Firestore sign_images/P.101: { cloudinary_id }
   ↓
9. UI /bien-bao card P.101 dùng <CloudinaryImage publicId="..." preset="sign-thumb" />
   ↓ URL: res.cloudinary.com/.../w_200,h_200,c_fit,f_auto,q_auto,b_white/...
   ↓ Browser load WebP 12KB (giảm 99% từ 5MB gốc)
```

Admin upload 1 lần → Cloudinary serve ảnh đó với 5+ kích thước khác nhau:
- `sign-thumb` 200×200 cho card listing
- `sign-detail` 400×400 cho modal detail
- `original` cho download admin

### User upload avatar

Tương tự, dùng `folder='avatar'`. PublicId ép = `trishteam/avatars/{uid}` →
upload lần sau ghi đè lên file cũ, không tốn quota.

URL transformations cho avatar (sinh ra từ 1 file gốc):
- `avatar-32` cho sidebar/comments
- `avatar-64` cho navbar
- `avatar-128` cho profile card
- `avatar-256` cho profile hero

### Blog post

Hero ảnh: `folder='post'`, preset `post-hero` (1200×630 cho OG meta).
Inline ảnh: preset `post-inline` (max width 1200, giữ aspect).

KHÔNG ép max size ảnh inline → đảm bảo ảnh kỹ thuật (sơ đồ kết cấu, bản
vẽ AutoCAD, screenshot code) hiển thị nét.

### Video blog

YouTube/Vimeo embed qua syntax markdown:
```markdown
{{youtube:dQw4w9WgXcQ}}
{{vimeo:123456789}}
```

## Setup từ đầu (1 lần)

### 1. Đăng ký Cloudinary

```
https://cloudinary.com/users/register/free
→ Sign up bằng email
→ Verify email
→ Dashboard hiện 3 trường:
   - Cloud name (vd: dxxx7example)
   - API Key (vd: 123456789012345)
   - API Secret (vd: aBcDeFg-HiJk_LmNoPq)
```

### 2. Set env vars

**Local dev** (`website/.env.local`):
```bash
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=dxxx7example
CLOUDINARY_API_KEY=123456789012345
CLOUDINARY_API_SECRET=aBcDeFg-HiJk_LmNoPq
```

**Production** (Vercel project settings → Environment Variables):
- `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` (Production + Preview + Development)
- `CLOUDINARY_API_KEY` (Production + Preview)
- `CLOUDINARY_API_SECRET` (Production + Preview, **Sensitive**)

### 3. Deploy

```bash
git push origin main  # Vercel auto-deploy
```

## URL pattern Cloudinary

```
https://res.cloudinary.com/{cloud_name}/image/upload/{transformations}/{public_id}.{format}
```

**Ví dụ thực tế**:
```
https://res.cloudinary.com/dxxx7example/image/upload/
  w_256,h_256,c_fill,g_face,f_auto,q_auto,r_max/
  trishteam/avatars/dOio23xyz
```

Transformations chính (tham số URL):
- `w_256` width 256px
- `h_256` height 256px
- `c_fill` crop fill (cắt giữa, giữ aspect)
- `c_fit` crop fit (vừa, không cắt)
- `g_face` gravity face (Cloudinary tự nhận diện mặt → crop trung tâm vào mặt — perfect cho avatar)
- `f_auto` format auto (WebP/AVIF tuỳ browser)
- `q_auto` quality auto (cân bằng size + chất lượng)
- `r_max` border radius max → tròn
- `b_white` background trắng (cho biển báo trong suốt)

## Files đã ship

| File | Vai trò |
|---|---|
| `website/lib/cloudinary.ts` | Client URL builder + folder convention + preset enum |
| `website/app/api/cloudinary/sign/route.ts` | Server endpoint ký upload, check role admin/owner |
| `website/components/cloudinary-uploader.tsx` | Drag-drop / file pick → Cloudinary signed upload + progress bar |
| `website/components/cloudinary-image.tsx` | Render `<img>` với publicId + preset transformation |
| `website/components/avatar-uploader.tsx` | Migrated từ Firebase Storage sang Cloudinary |
| `storage.rules` | Firebase Storage rules (giữ làm fallback / temp) |

## Firestore schema mới

```typescript
// users/{uid}
interface TrishUser {
  // ...existing fields
  cloudinary_avatar_id?: string;   // vd "trishteam/avatars/uid123"
  photo_url?: string;              // legacy + Cloudinary 256 URL cache
}

// Phase 19.13 sẽ thêm:
// sign_images/{code}        → { cloudinary_id, uploaded_at, uploader_uid }
// bridge_images/{id}        → { cloudinary_id, uploaded_at, uploader_uid }
// posts/{id}                → field hero_cloudinary_id
```

## Best practices

1. **Upload nguyên size**: KHÔNG resize trước. Cloudinary làm tốt hơn canvas browser.
2. **Lưu publicId, không lưu URL**: URL chứa transformation, có thể đổi. PublicId stable.
3. **Cache URL**: Cloudinary CDN cache 1 năm. Đổi transformation = đổi URL = cache miss tự nhiên.
4. **Folder convention**: `trishteam/{type}/...` để query/cleanup theo nhóm.
5. **Tag uploads**: `tags: 'sign,p101'` giúp Cloudinary dashboard search.

## Troubleshooting

**Upload fail "Invalid Signature"**:
- Check `CLOUDINARY_API_SECRET` đúng chưa (trim space)
- Check timestamp client/server lệch <60s

**Upload fail "401 Unauthorized" trước khi đến Cloudinary**:
- Firebase ID token expired — gọi `getIdToken(true)` để refresh

**Ảnh hiện sai size**:
- Check transformation URL có khớp preset không
- Browser cache cũ → hard reload (Ctrl+Shift+R)

**Free quota đã hết**:
- Dashboard Cloudinary → Reports → check usage
- Migrate ảnh ít dùng sang Backblaze B2 (10GB free)
- Hoặc upgrade Cloudinary $89/tháng (gấp 10 quota)
