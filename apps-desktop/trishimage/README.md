# TrishImage — Photo organizer (event + face + aspect)

**Tauri 2** + **React 18** + **@trishteam/core/images**.

Quét thư mục ảnh của bạn, đọc EXIF + dimensions **không decode pixel**
(header ≤ 512 byte), rồi nhóm thành event theo time gap và phân loại
aspect + face bucket. Tối ưu cho gallery cá nhân vài chục nghìn ảnh.

## Điểm đặc biệt

- **Không decode pixel** → scan 10 000+ ảnh trong vài giây. Rust dùng
  `imagesize` (chỉ đọc header) + `kamadak-exif` (pure Rust, không cần
  libexif).
- **Event grouping tự động**: ảnh cách nhau > 8 giờ (config được) bị
  split thành event khác. Phù hợp với "chuyến đi Đà Lạt 3 ngày" vs
  "cafe sáng thứ 7".
- **Aspect classification**: landscape / portrait / square / panorama.
  Panorama = ratio ≥ 2.0 hoặc ≤ 0.5.
- **Face bucket heuristic (v1)**: solo / pair / group / none / unknown
  dựa trên `face_count`. Wire ONNX face detector ở **14.3.4.b**.
- **Safe scan**: hard cap `max_entries` (mặc định 5 000, max 200 000),
  `max_depth` (mặc định 8, max 32), bỏ qua hidden folder (node_modules,
  .git, dot-prefix).
- **Dev fallback**: khi chưa start Tauri, app tự load 24 ảnh giả chia
  thành 3 events để dev UI nhanh trong browser.

## Kiến trúc

```
┌──────────────────────────────────────────────────────────┐
│ @trishteam/core/images  — pure TS, Vitest (40 tests)      │
│   types.ts       ImageMeta, EventGroup, AspectClass       │
│   classify.ts    classifyAspect, enrichImage, filter      │
│   group.ts       groupByEvent / groupByDay / groupByMonth │
│   aggregate.ts   summarizeImages, formatBytes             │
│   faces.ts       FaceBucket, groupByFaceBucket            │
└──────────────────────────────────────────────────────────┘
                         ▲ imported
                         │
┌──────────────────────────────────────────────────────────┐
│ apps-desktop/trishimage (React)                           │
│   App.tsx        sidebar filters + EventsView/FacesView   │
│   tauri-bridge   pickFolder, scanImages, DEV_FALLBACK     │
└──────────────────────────────────────────────────────────┘
                         ▲ invoke
                         │
┌──────────────────────────────────────────────────────────┐
│ src-tauri (Rust 1.77)                                     │
│   scan_images   walkdir + kamadak-exif + imagesize        │
└──────────────────────────────────────────────────────────┘
```

## Domain model

```ts
interface ImageMeta {
  path: string;
  name: string;
  ext: string;              // "jpg" | "png" | "heic" | ...
  size_bytes: number;
  taken_ms: number | null;  // EXIF DateTimeOriginal → fallback mtime
  width: number | null;
  height: number | null;
  aspect: AspectClass;      // landscape | portrait | square | panorama | unknown
  camera: string | null;    // EXIF Model
  has_gps: boolean;         // EXIF GPSLatitude present
  face_count: number | null; // null = chưa phân tích
}
```

### Event grouping

Ảnh sort theo `taken_ms` tăng dần. Nếu gap giữa 2 ảnh liên tiếp >
`DEFAULT_EVENT_GAP_MS` (8h) → split event. Ảnh không có timestamp gộp
vào bucket `unknown`.

Label mặc định `YYYY-MM-DD (N ảnh)` — xem `group.ts` để customize.

### Aspect classification

```
ratio = width / height
panorama:   ratio >= 2.0  HOẶC ratio <= 0.5
landscape:  ratio > 1.15
portrait:   ratio < 1 / 1.15 (~0.87)
square:     trong khoảng (0.87, 1.15)
unknown:    thiếu width hoặc height
```

### Face bucket (v1 heuristic)

```
face_count null → unknown
face_count 0    → none
face_count 1    → solo
face_count 2    → pair
face_count ≥ 3  → group
```

Rust hiện trả `face_count: None` cho mọi ảnh. Phase **14.3.4.b** sẽ
wire `ort` + ONNX BlazeFace để fill thực tế.

## Commands

```
pnpm dev          # Vite ở port 1430
pnpm build        # tsc --noEmit + vite build
pnpm tauri:dev    # Rust + Vite full stack
pnpm tauri:build  # production bundle (msi/nsis/dmg/deb/appimage)
pnpm typecheck    # tsc chỉ
```

## Thao tác

1. Bấm **Chọn thư mục…** (topbar).
2. Đợi scan xong — thời gian hiển thị ở Tổng quan (ms).
3. Filter aspect bằng pill ở sidebar, hoặc đổi view (Events / Faces / Tất cả).

## Giới hạn hiện tại (Phase 14.3.4)

- `face_count` luôn `null` (chưa có ONNX). Face bucket chỉ chia `none`
  (nếu có `face_count = 0`) và `unknown`.
- Chưa có thumbnail thật — placeholder dựa trên extension + aspect màu.
- Chưa có viewer full-size (dự kiến 14.3.4.c).
- Chưa nhớ folder đã scan giữa các lần mở app.
- Không hỗ trợ RAW (CR2, ARW, NEF) — chỉ JPG/PNG/WebP/GIF/BMP/TIFF/HEIC.

## Roadmap tiếp theo

- **14.3.4.b**: ONNX BlazeFace → `face_count` thực + embedding cho
  person clustering.
- **14.3.4.c**: Thumbnail cache (LRU) + viewer modal.
- **14.5**: Sync metadata lên Firestore cho web companion.
- **15.x**: Port Zalo Mini App (scan Zalo media local storage).
