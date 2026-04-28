# /public/bridges/

Ảnh cầu Việt Nam.

## Quy ước đặt tên
Theo `id` trong `data/bridges-vn.ts` — ví dụ:
- `cau-my-thuan-2.jpg` cho cầu Mỹ Thuận 2
- `cau-can-tho.jpg` cho cầu Cần Thơ

## Tối ưu trước commit
1. Resize 1200×800 (16:9 hoặc 3:2 landscape)
2. JPG quality 80%
3. Compress qua tinypng.com hoặc imageoptim
4. Mỗi cầu ~80-200 KB sau optimize

## Wire vào data
Sau khi đặt ảnh, update `website/data/bridges-vn.ts`:
```ts
{
  id: 'cau-my-thuan-2',
  // ...
  image_url: '/bridges/cau-my-thuan-2.jpg',
},
```
