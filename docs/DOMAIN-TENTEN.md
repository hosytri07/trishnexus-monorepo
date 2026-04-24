# Domain Setup — `trishteam.io.vn` (TENTEN)

Guide cấu hình domain tiếng Việt mua qua TENTEN (tenten.vn) trỏ về
deployment TrishTEAM. Có 2 lựa chọn host: **Vercel** (khuyến nghị cho
MVP) hoặc **Firebase Hosting**. Cả 2 đều miễn phí SSL (Let's Encrypt).

---

## 0. Trước khi bắt đầu

- [ ] Đã có account TENTEN, login vào <https://id.tenten.vn>.
- [ ] Domain đã active (không còn trạng thái "đang xử lý").
- [ ] Đã decide host:
  - **Vercel** (apex + www): dễ nhất, auto-preview PR, bundled CDN.
  - **Firebase Hosting**: gộp chung ecosystem Firebase (Auth/Firestore),
    1 nguồn truth về billing.

---

## 1. Đăng nhập TENTEN → DNS Manager

1. Vào <https://id.tenten.vn/> → Đăng nhập.
2. Menu trái → **Dịch vụ của tôi** → **Tên miền** → bấm vào
   `trishteam.io.vn`.
3. Tab **Quản lý DNS** (hoặc **Nameserver / DNS**). TENTEN mặc định
   dùng nameserver của họ (`ns1.tenten.vn`, `ns2.tenten.vn`) — giữ
   nguyên, chỉ thêm record.

> **Lưu ý:** Nếu muốn dùng Cloudflare làm DNS (proxy + WAF miễn phí),
> đổi nameserver sang Cloudflare trước (phần §5 bên dưới). Với MVP
> dùng DNS TENTEN trực tiếp là đủ.

---

## 2A. Option A — Point về Vercel (khuyến nghị MVP)

### 2A.1 Thêm domain trên Vercel

1. Vercel Dashboard → project `trishteam` → tab **Settings → Domains**.
2. Nhập `trishteam.io.vn` → **Add**. Vercel sẽ hiện record cần thêm:
   - Apex: `A 76.76.21.21` (IP cố định của Vercel).
   - Subdomain `www`: `CNAME cname.vercel-dns.com`.
3. Lặp lại bước 2 cho `www.trishteam.io.vn` để cả 2 cùng hoạt động.

### 2A.2 Thêm record ở TENTEN

Ở DNS Manager TENTEN, thêm các record sau:

| Type | Host | Value | TTL |
|------|------|-------|-----|
| `A` | `@` | `76.76.21.21` | 3600 |
| `CNAME` | `www` | `cname.vercel-dns.com.` | 3600 |

> Ghi chú TENTEN:
> - Ô "Host" = "@" nghĩa là apex domain (`trishteam.io.vn` không `www`).
> - Nếu TENTEN bắt Host phải ghi đầy đủ, nhập `trishteam.io.vn`.
> - **KHÔNG** thêm `AAAA` (IPv6) trừ khi Vercel yêu cầu — tránh mismatch.
> - Chọn đúng type `A` hoặc `CNAME` — TENTEN có dropdown.
> - Bấm **Thêm / Lưu** rồi đợi 5-30 phút để DNS propagate.

### 2A.3 Xác nhận

```bash
# Kiểm tra A record
dig trishteam.io.vn +short
# Kết quả mong đợi: 76.76.21.21

# Kiểm tra CNAME www
dig www.trishteam.io.vn +short
# Kết quả: cname.vercel-dns.com.  76.76.21.21
```

Vào Vercel Settings → Domains: badge **Valid Configuration** + SSL
**Issued** (Let's Encrypt auto, 1-5 phút).

---

## 2B. Option B — Point về Firebase Hosting

### 2B.1 Kết nối domain trong Firebase

1. Firebase Console → project `trishteam-prod` → **Hosting** →
   **Add custom domain**.
2. Nhập `trishteam.io.vn` → Next. Firebase hiện:
   - TXT record `_firebase_hosting` để verify ownership.
   - Sau verify: 2 A record trỏ về Firebase IPs (thường
     `151.101.x.x` hoặc IP khác — copy từ console vì rotating).
3. Thêm cả `www.trishteam.io.vn` để redirect về apex.

### 2B.2 Thêm record ở TENTEN

| Type | Host | Value | TTL |
|------|------|-------|-----|
| `TXT` | `@` | (chuỗi Firebase cho) | 3600 |
| `A` | `@` | (IP 1 Firebase show) | 3600 |
| `A` | `@` | (IP 2 Firebase show) | 3600 |
| `CNAME` | `www` | `trishteam.io.vn.` | 3600 |

Đợi propagate → quay lại Firebase Console → bấm **Verify** → sau vài
phút status chuyển **Connected** + **SSL: Issued**.

### 2B.3 Deploy

```bash
cd trishnexus-monorepo/website
npm run build
# Hosting tĩnh chỉ serve được nếu next.config export = 'standalone'
# hoặc dùng Firebase Cloud Functions cho SSR. Với App Router +
# Route Handlers / Server Components → CHỌN Option A (Vercel).
firebase deploy --only hosting
```

> **Caveat quan trọng:** Next.js 14 App Router có Server Components +
> Route Handlers (`/api/admin/set-role`) cần Node runtime. Firebase
> Hosting chỉ tĩnh → cần thêm Cloud Functions hoặc Cloud Run. Nếu muốn
> đơn giản, chọn **Option A (Vercel)**.

---

## 3. Cập nhật Firebase Authorized Domains

Sau khi domain hoạt động (dù Vercel hay Firebase Hosting):

1. Firebase Console → **Authentication** → tab **Settings** →
   **Authorized domains**.
2. Bấm **Add domain** → thêm cả 2:
   - `trishteam.io.vn`
   - `www.trishteam.io.vn`
3. Giữ lại `localhost` + `trishteam-prod.firebaseapp.com` (mặc định).
4. Nếu có Google OAuth: Google Cloud Console → **APIs & Services →
   Credentials** → OAuth client → **Authorized JavaScript origins** +
   **Authorized redirect URIs** thêm `https://trishteam.io.vn` +
   `https://www.trishteam.io.vn`.

---

## 4. Next.js config

`website/next.config.mjs` — đảm bảo redirect `www` → apex (hoặc ngược
lại, tuỳ SEO preference):

```js
// Redirect www → apex (canonical)
const nextConfig = {
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'www.trishteam.io.vn' }],
        destination: 'https://trishteam.io.vn/:path*',
        permanent: true,
      },
    ];
  },
};
```

Update `metadata.metadataBase` ở `app/layout.tsx`:

```ts
export const metadata: Metadata = {
  metadataBase: new URL('https://trishteam.io.vn'),
  // ...
};
```

→ OG image + canonical URL resolve đúng domain.

---

## 5. (Tùy chọn) Cloudflare proxy

**Lợi ích:** WAF miễn phí, cache tĩnh extra, ẩn IP gốc, analytics.

1. Tạo account <https://cloudflare.com> → **Add a Site** →
   `trishteam.io.vn` → Free plan.
2. Cloudflare scan DNS → import record hiện có (A + CNAME bước 2).
3. Copy 2 nameserver Cloudflare (ví dụ `ada.ns.cloudflare.com`,
   `fred.ns.cloudflare.com`).
4. Về TENTEN → **Nameserver** → đổi từ `ns1/ns2.tenten.vn` sang 2
   nameserver Cloudflare. Đợi 1-24h propagate.
5. Trong Cloudflare: bật **DNS → Proxy** (icon orange cloud) cho record
   `A @` + `CNAME www`. SSL/TLS → **Full (strict)**.

> **Caveat với Vercel:** Vercel yêu cầu proxy OFF cho verify đầu tiên,
> bật lại sau khi SSL issued. Nếu rắc rối → bỏ Cloudflare proxy, dùng
> DNS-only (grey cloud).

---

## 6. Smoke test sau khi live

```bash
# HTTPS redirect
curl -I http://trishteam.io.vn
# Mong đợi: 308 → https://

# SSL hợp lệ
curl -sI https://trishteam.io.vn | head -5

# WWW redirect về apex
curl -sI https://www.trishteam.io.vn | grep -i location
```

Browser check:
- [ ] `https://trishteam.io.vn` load dashboard, ổ khóa xanh.
- [ ] `https://www.trishteam.io.vn` → redirect 308 về apex.
- [ ] Đăng nhập Google OAuth popup → không báo lỗi domain.
- [ ] PWA: DevTools → Application → Manifest + Service Worker OK.
- [ ] `/admin` load sau login admin.

---

## 7. Các record mở rộng (để sau)

Khi cần email custom (`trí@trishteam.io.vn`):

| Type | Host | Value | Ghi chú |
|------|------|-------|---------|
| `MX` | `@` | mail provider (Zoho/ImprovMX/Google Workspace) | Priority 10 |
| `TXT` | `@` | `v=spf1 include:...` | SPF chống spoof |
| `TXT` | `_dmarc` | `v=DMARC1; p=quarantine; rua=mailto:...` | DMARC report |

Domain `.io.vn` TENTEN support đầy đủ các record này — thêm qua DNS
Manager tương tự bước 2.

---

## 8. Troubleshooting TENTEN

| Triệu chứng | Nguyên nhân | Fix |
|-------------|-------------|-----|
| Không thấy tab "Quản lý DNS" | Domain chưa active | Đợi 1-4h sau mua, hoặc gửi ticket TENTEN |
| Record lưu nhưng dig không thấy | TTL cũ chưa hết | `dig +trace`, đợi TTL cũ (thường 1h) |
| Vercel báo "Invalid Configuration" | Apex có thêm AAAA sai | Xóa AAAA, chỉ giữ A |
| SSL stuck "Issuing..." | CAA record chặn | Thêm CAA `@ 0 issue "letsencrypt.org"` |
| Google OAuth popup fail | Chưa add domain vào Firebase Auth + Google Cloud | §3 |
| 502 Bad Gateway | Firebase Hosting + SSR → cần Cloud Functions | Chuyển sang Vercel (Option A) |

---

## 9. Chi phí & gia hạn

- `.io.vn` tại TENTEN: ~120-180k VND/năm (gia hạn tương tự).
- Vercel Hobby: **miễn phí** cho personal project (bandwidth 100GB/tháng).
- Firebase Hosting: **miễn phí** Spark plan (10GB bandwidth/tháng).
- Firebase Auth + Firestore: miễn phí quota (đã đủ cho 1000 user đầu).

**Nhắc nhở gia hạn:** TENTEN gửi email reminder trước 60/30/7 ngày hết hạn.
Set calendar reminder thủ công 14/4 hàng năm (hoặc ngày mua + 11 tháng).

---

**Kí setup:** _______ (Trí)   **Ngày domain live:** _______
