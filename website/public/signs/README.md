# /public/signs/

Ảnh biển báo QC41:2024.

## Quy ước đặt tên
`<code-lowercase-with-dash>.png` — ví dụ:
- `p-101.png` cho biển P.101 (Đường cấm)
- `w-201a.png` cho biển W.201a (Chỗ ngoặt nguy hiểm)
- `r-301a.png` cho biển R.301a (Hướng đi phải theo)

## Tối ưu trước commit
1. Resize 200×200 (vuông cho biển tròn) hoặc 200×175 (tam giác)
2. PNG với background transparent (giữ rìa biển nét)
3. Compress qua tinypng.com — giảm 60-70% size mà giữ chất lượng
4. Mỗi biển ~10-30 KB sau optimize

## Wire vào data
Sau khi đặt ảnh, update `website/data/traffic-signs.ts`:
```ts
{
  code: 'P.101',
  // ...
  image_url: '/signs/p-101.png',
},
```
