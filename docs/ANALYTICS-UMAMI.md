# Umami self-host — setup guide (Phase 16.6)

Tài liệu hướng dẫn dựng **Umami** ở `analytics.trishteam.io.vn` làm
analytics riêng cho TrishTEAM. Không phụ thuộc Google Analytics, không
cookie, không cần GDPR modal.

---

## Vì sao chọn Umami?

Umami là open-source (MIT), viết bằng Next.js 14 + Prisma + Postgres.
So với Google Analytics:

- **Cookie-less** — dùng UUID day-scoped hash từ IP + UA, không lưu
  persistent cookie. Không cần GDPR banner.
- **Lightweight** — tracker script ~2KB gzipped (GA4 ~50KB).
- **Own your data** — mọi metric lưu trong Postgres của bạn, xuất CSV bất
  cứ lúc nào, không bị Google block theo khu vực.
- **Đẹp** — UI gọn, dark mode sẵn, giống TrishTEAM.

So với Plausible:
- Plausible cũng tốt, nhưng Umami có bản tracker nhẹ hơn và quota
  submission cao hơn khi self-host.
- Umami hỗ trợ custom event (`umami.track('cta_click', {section:'hero'})`).

---

## Yêu cầu VPS

| Resource | Tối thiểu | Khuyến nghị |
|----------|-----------|-------------|
| RAM      | 512MB     | 1GB         |
| vCPU     | 1         | 1           |
| Disk     | 10GB      | 20GB SSD    |
| OS       | Ubuntu 22.04 / Debian 12 |  |

Phù hợp: Vultr $5/tháng, Hetzner CX11 €4.15/tháng, DigitalOcean $6/tháng.

---

## Bước 1 — DNS

Trong TENTEN (domain `trishteam.io.vn`):

| Type | Host       | Value          | TTL  |
|------|------------|----------------|------|
| A    | analytics  | <IP VPS>       | 300  |

Kiểm tra sau 5 phút: `dig analytics.trishteam.io.vn +short`.

---

## Bước 2 — Cài Docker + Caddy trên VPS

```bash
# Install Docker + compose
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker

# Install Caddy (có auto-SSL Let's Encrypt)
sudo apt update
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install -y caddy
```

---

## Bước 3 — Deploy Umami

```bash
cd /opt
sudo git clone https://github.com/hosytri77/trishnexus-monorepo.git
cd trishnexus-monorepo/infra/analytics-umami

sudo cp .env.example .env
# sinh random secret:
echo "POSTGRES_PASSWORD=$(openssl rand -base64 32)" | sudo tee -a .env
echo "APP_SECRET=$(openssl rand -hex 32)" | sudo tee -a .env
# (xoá 2 dòng placeholder cũ trong .env)

sudo docker compose up -d
sudo docker compose logs -f   # theo dõi khởi động (Ctrl-C khi thấy "Ready")
```

---

## Bước 4 — Caddy reverse proxy

```bash
sudo cp /opt/trishnexus-monorepo/infra/analytics-umami/Caddyfile /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Caddy sẽ tự xin SSL cho `analytics.trishteam.io.vn` trong ~30 giây.
Kiểm tra:

```bash
curl -I https://analytics.trishteam.io.vn
# Kỳ vọng: HTTP/2 200
```

---

## Bước 5 — Đăng nhập Umami lần đầu

1. Mở `https://analytics.trishteam.io.vn` trên browser.
2. Login: `admin` / `umami`.
3. **Đổi password ngay** (Settings → Profile → Change password).
4. Vào `Settings` → `Websites` → `+ Add website`:
   - Name: `TrishTEAM`
   - Domain: `trishteam.io.vn`
5. Copy `Website ID` (UUID) ở cột bên phải — sẽ paste vào Vercel env.

---

## Bước 6 — Wire vào website

Trên Vercel (hoặc local `.env.local`):

```env
NEXT_PUBLIC_UMAMI_SRC=https://analytics.trishteam.io.vn/script.js
NEXT_PUBLIC_UMAMI_WEBSITE_ID=<UUID từ bước 5>
# Tuỳ chọn: chỉ track trên production domain (tránh dev noise):
NEXT_PUBLIC_UMAMI_DOMAINS=trishteam.io.vn
```

Redeploy (Vercel tự pick env mới). Component
`components/umami-tracker.tsx` sẽ inject script khi cả 2 env set. Nếu
thiếu một trong hai → render null (không request network).

---

## Bước 7 — Custom event tracking

```tsx
'use client';
import { track } from '@/lib/analytics';

<button onClick={() => track('download_click', { os: 'windows', version: '1.0.0' })}>
  Tải Windows
</button>
```

Event xuất hiện trong Umami dashboard: `Events` tab, sort theo count.

---

## Bước 8 — Backup Postgres

Tạo cron daily dump:

```bash
sudo mkdir -p /opt/backups/umami
sudo tee /etc/cron.daily/umami-backup >/dev/null <<'SH'
#!/bin/bash
set -e
DATE=$(date +%Y%m%d)
docker exec umami-db pg_dumpall -U umami | gzip > /opt/backups/umami/umami-$DATE.sql.gz
# Giữ 14 ngày gần nhất
find /opt/backups/umami -name 'umami-*.sql.gz' -mtime +14 -delete
SH
sudo chmod +x /etc/cron.daily/umami-backup
```

Upload backup lên B2/R2/S3 bằng rclone (Phase 16.7).

---

## Upgrade Umami

```bash
cd /opt/trishnexus-monorepo/infra/analytics-umami
sudo docker compose pull
sudo docker compose up -d
sudo systemctl reload caddy   # purge edge cache script.js
```

Umami schema migration tự động chạy khi container boot.

---

## Troubleshooting

| Triệu chứng | Nguyên nhân | Cách fix |
|-------------|-------------|----------|
| 502 Bad Gateway ở Caddy | Umami container chưa ready | `docker compose logs umami` — đợi 10-20s khi first boot |
| `script.js` 404 | Domain whitelist Umami sai | Vào Umami Settings → Websites → edit → bỏ prefix `https://` |
| Cookie consent modal hiện | `data-do-not-track` chưa bật | Check env `NEXT_PUBLIC_UMAMI_DOMAINS` set đúng domain |
| Event bị mất | DNT=1 (user bật Do Not Track) | Đúng behavior — Umami không ghi khi DNT |
| Dashboard trống | Tracker block bởi ad-blocker | uBlock Origin block Umami trên list EasyPrivacy — show notice "Hãy whitelist analytics.trishteam.io.vn" |

---

## Tham khảo

- Docs chính thức: https://umami.is/docs
- Repo: https://github.com/umami-software/umami
- Migration guide v1 → v2: https://umami.is/docs/migrate-v1-v2
